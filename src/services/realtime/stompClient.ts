import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { environment } from '../../environment/environment';
import { storageService } from '../storageService';
import { getDeviceTimeZone } from '../../utils/dates';

/**
 * ONE shared STOMP 1.2-over-WebSocket connection for the whole app
 * (notifications + messages), hand-written because no STOMP/SockJS client is
 * bundled and React Native's plain WebSocket is all we need.
 *
 * Endpoint: `${API_BASE with http->ws / https->wss}/ws/native` (raw WebSocket
 * STOMP endpoint). The CONNECT frame carries `Authorization: Bearer <jwt>`;
 * the server rejects the session without it.
 *
 * - `connect(token, userId)` is ref-counted: it returns a release function and
 *   the socket closes once the last holder releases (or on `disconnect()`, e.g.
 *   logout). Connecting for a different user tears the old session down first.
 * - `subscribe(destination, cb)` returns an unsubscribe; subscriptions survive
 *   reconnects (re-sent after every CONNECTED).
 * - Heart-beats are negotiated (10s/10s); a silent socket (no frame and no
 *   heart-beat for 3x the server interval) is treated as dead and recycled.
 * - Reconnects use exponential backoff with jitter. After a drop, the next
 *   successful CONNECTED emits 'reconnected' exactly once, so consumers can do
 *   ONE catch-up re-fetch (there is no polling anywhere).
 * - When the app returns to the foreground and the socket is down, it
 *   reconnects immediately (resetting the backoff) instead of waiting.
 */

type MessageCallback = (body: unknown, headers: Record<string, string>) => void;
export type ConnectionEvent = 'connected' | 'reconnected' | 'disconnected';
type ConnectionListener = (event: ConnectionEvent) => void;

const NUL = '\u0000';
const CLIENT_HEARTBEAT_MS = 10_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export const buildWsUrl = () =>
  environment.baseUrl
    .replace(/\/+$/, '')
    .replace(/^https:/i, 'wss:')
    .replace(/^http:/i, 'ws:') + '/ws/native';

const escapeHeader = (v: string) => v.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/:/g, '\\c');
const unescapeHeader = (v: string) =>
  v.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c === 'r' ? '\r' : c === 'c' ? ':' : c));

/**
 * UTF-8 bytes of a frame. React Native (New Architecture, Android) passes WebSocket
 * text through JNI as a C string, so everything after the STOMP NUL terminator is
 * cut off and the server never sees a complete frame (CONNECT left unanswered).
 * Frames are therefore sent as binary messages, which Spring's STOMP handler accepts.
 */
const utf8Bytes = (text: string): ArrayBuffer => {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i += 1;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out).buffer;
};

const utf8Decode = (buf: ArrayBuffer): string => {
  const b = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp = c;
    if (c >= 0xf0) cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xe0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xc0) cp = ((c & 31) << 6) | (b[i++] & 63);
    out += String.fromCodePoint(cp);
  }
  return out;
};

const frame = (command: string, headers: Record<string, string>, body = '') => {
  // STOMP 1.2: CONNECT/CONNECTED headers are NOT escaped.
  const esc = command === 'CONNECT' ? (v: string) => v : escapeHeader;
  return `${command}\n${Object.entries(headers)
    .map(([k, v]) => `${k}:${esc(v)}`)
    .join('\n')}\n\n${body}${NUL}`;
};

interface Subscription {
  id: string;
  callbacks: Set<MessageCallback>;
}

class StompClient {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private token: string | null = null;
  private refCount = 0;
  private generation = 0;
  private connected = false;
  private hasConnectedOnce = false;
  private dropped = false;
  private attempts = 0;
  private buffer = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastServerActivity = 0;
  private serverHeartbeatMs = 0;
  private subIdSeq = 0;
  private subscriptions = new Map<string, Subscription>();
  private listeners = new Set<ConnectionListener>();
  private appStateSub: NativeEventSubscription | null = null;

  /** Starts (or joins) the shared session for `userId`. Returns a release function. */
  connect(token: string | null, userId: string): () => void {
    if (this.userId && this.userId !== userId) this.teardown(true);
    if (token) this.token = token;
    if (this.userId !== userId) {
      this.userId = userId;
      this.generation += 1;
      this.refCount = 0;
    }
    this.refCount += 1;
    const gen = this.generation;
    if (!this.appStateSub) this.appStateSub = AppState.addEventListener('change', this.onAppState);
    if (!this.ws && !this.reconnectTimer) this.open();

    let released = false;
    return () => {
      if (released || gen !== this.generation) return;
      released = true;
      this.refCount -= 1;
      if (this.refCount <= 0) this.disconnect();
    };
  }

  /**
   * A new JWT was issued for the SAME user (role switch / roles refresh). The open STOMP
   * session stays valid (it is bound to the user, not to the selected role), so nothing is
   * torn down; the new token is simply used for the next (re)connect.
   */
  updateToken(token: string | null) {
    if (token) this.token = token;
  }

  /** Hard stop (logout / user change): closes the socket and forgets every subscription. */
  disconnect() {
    this.teardown(true);
  }

  isConnected() {
    return this.connected;
  }

  subscribe(destination: string, cb: MessageCallback): () => void {
    let sub = this.subscriptions.get(destination);
    if (!sub) {
      sub = { id: `sub-${++this.subIdSeq}`, callbacks: new Set() };
      this.subscriptions.set(destination, sub);
      if (this.connected) this.send(frame('SUBSCRIBE', { id: sub.id, destination, ack: 'auto' }));
    }
    sub.callbacks.add(cb);
    const current = sub;
    return () => {
      current.callbacks.delete(cb);
      if (current.callbacks.size === 0 && this.subscriptions.get(destination) === current) {
        this.subscriptions.delete(destination);
        if (this.connected) this.send(frame('UNSUBSCRIBE', { id: current.id }));
      }
    };
  }

  /**
   * Sends a JSON body to an application destination (e.g. `/app/cours/{id}/chat`).
   * Returns false when the socket isn't connected (nothing is queued).
   */
  publish(destination: string, body: unknown = {}): boolean {
    if (!this.connected) return false;
    this.send(frame('SEND', { destination, 'content-type': 'application/json' }, JSON.stringify(body ?? {})));
    return true;
  }

  onConnectionEvent(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ── internals ──────────────────────────────────────────────────────────

  private emit(event: ConnectionEvent) {
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch {
        // a faulty listener must not break the socket
      }
    });
  }

  private send(data: string) {
    try {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data.includes(NUL) ? utf8Bytes(data) : data);
    } catch {
      // onclose will handle it
    }
  }

  private onAppState = (state: AppStateStatus) => {
    if (state !== 'active' || !this.userId || this.refCount <= 0) return;
    if (!this.connected && !this.ws) {
      // Socket dropped while backgrounded: reconnect now instead of waiting for the backoff.
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.attempts = 0;
      this.open();
    }
  };

  private async open() {
    const gen = this.generation;
    const userId = this.userId;
    if (!userId) return;
    const stored = await storageService.getUserToken().catch(() => null);
    if (gen !== this.generation || this.ws) return;
    const token = stored || this.token;
    if (stored) this.token = stored;
    let ws: WebSocket;
    try {
      ws = new WebSocket(buildWsUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    try {
      (ws as unknown as { binaryType: string }).binaryType = 'arraybuffer';
    } catch {
      // older runtimes: text frames only
    }
    this.buffer = '';
    ws.onopen = () => {
      const headers: Record<string, string> = {
        'accept-version': '1.2,1.1',
        host: 'scholchat',
        'heart-beat': `${CLIENT_HEARTBEAT_MS},${CLIENT_HEARTBEAT_MS}`,
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const timeZone = getDeviceTimeZone();
      if (timeZone) headers['X-Timezone'] = timeZone;
      ws.send(utf8Bytes(frame('CONNECT', headers)));
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.lastServerActivity = Date.now();
      let data = typeof event.data === 'string' ? event.data : event.data instanceof ArrayBuffer ? utf8Decode(event.data) : '';
      // Same JNI string issue on the way in: the NUL may be dropped. Spring sends whole
      // frames per WebSocket message, so a non-empty message without NUL is one complete frame.
      if (data && !data.includes(NUL) && data.trim() !== '') data += NUL;
      this.buffer += data;
      let idx = this.buffer.indexOf(NUL);
      while (idx >= 0) {
        this.handleFrame(this.buffer.slice(0, idx));
        this.buffer = this.buffer.slice(idx + 1);
        idx = this.buffer.indexOf(NUL);
      }
      if (this.buffer.trim() === '') this.buffer = '';
    };
    ws.onerror = () => {
      // onclose follows and handles reconnection
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.handleDrop();
    };
  }

  private handleFrame(raw: string) {
    const text = raw.replace(/^[\r\n]+/, '');
    if (!text) return; // heart-beat
    const sep = text.indexOf('\n\n');
    const head = (sep >= 0 ? text.slice(0, sep) : text).replace(/\r/g, '');
    const body = sep >= 0 ? text.slice(sep + 2) : '';
    const lines = head.split('\n');
    const command = lines[0].trim();
    const headers: Record<string, string> = {};
    lines.slice(1).forEach((line) => {
      const i = line.indexOf(':');
      if (i <= 0) return;
      const key = line.slice(0, i);
      if (!(key in headers)) headers[key] = command === 'CONNECTED' ? line.slice(i + 1) : unescapeHeader(line.slice(i + 1));
    });

    if (command === 'CONNECTED') {
      this.connected = true;
      this.attempts = 0;
      this.startHeartbeats(headers['heart-beat']);
      this.subscriptions.forEach((sub, destination) =>
        this.send(frame('SUBSCRIBE', { id: sub.id, destination, ack: 'auto' }))
      );
      const wasDropped = this.dropped && this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      this.dropped = false;
      this.emit('connected');
      if (wasDropped) this.emit('reconnected');
    } else if (command === 'MESSAGE') {
      const destination = headers.destination;
      const sub = destination ? this.subscriptions.get(destination) : undefined;
      if (!sub) return;
      let parsed: unknown = body;
      try {
        parsed = body ? JSON.parse(body) : null;
      } catch {
        // not JSON — hand the raw text over
      }
      sub.callbacks.forEach((cb) => {
        try {
          cb(parsed, headers);
        } catch {
          // consumer error — ignore
        }
      });
    } else if (command === 'ERROR') {
      try {
        this.ws?.close();
      } catch {
        // ignore
      }
    }
  }

  private startHeartbeats(serverHeader?: string) {
    this.stopHeartbeats();
    const [sx, sy] = (serverHeader ?? '0,0').split(',').map((n) => parseInt(n, 10) || 0);
    // Outgoing: we promised CLIENT_HEARTBEAT_MS, server wants sy.
    if (sy > 0) {
      const every = Math.max(CLIENT_HEARTBEAT_MS, sy);
      this.heartbeatTimer = setInterval(() => this.send('\n'), every);
    } else {
      // Server doesn't ask for heart-beats; still keep proxies from idling us out.
      this.heartbeatTimer = setInterval(() => this.send('\n'), 25_000);
    }
    // Incoming: server sends every max(sx, ours).
    this.serverHeartbeatMs = sx > 0 ? Math.max(CLIENT_HEARTBEAT_MS, sx) : 0;
    this.lastServerActivity = Date.now();
    if (this.serverHeartbeatMs > 0) {
      this.watchdogTimer = setInterval(() => {
        if (Date.now() - this.lastServerActivity > this.serverHeartbeatMs * 3) {
          // Silent dead socket (common after the app sat in background): recycle it.
          const ws = this.ws;
          this.handleDrop();
          try {
            ws?.close();
          } catch {
            // ignore
          }
        }
      }, this.serverHeartbeatMs);
    }
  }

  private stopHeartbeats() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.heartbeatTimer = null;
    this.watchdogTimer = null;
  }

  private handleDrop() {
    const wasConnected = this.connected;
    this.connected = false;
    this.stopHeartbeats();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
    }
    this.ws = null;
    this.dropped = true;
    if (wasConnected) this.emit('disconnected');
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.userId || this.refCount <= 0) return;
    const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(this.attempts, 10));
    // "Equal jitter": half fixed, half random — avoids a thundering herd after a server restart.
    const delay = exp / 2 + Math.random() * (exp / 2);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private teardown(forgetSubscriptions: boolean) {
    this.generation += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeats();
    const ws = this.ws;
    this.ws = null;
    const wasConnected = this.connected;
    this.connected = false;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(utf8Bytes(frame('DISCONNECT', {})));
        ws.close();
      } catch {
        // ignore
      }
    }
    if (forgetSubscriptions) this.subscriptions.clear();
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.userId = null;
    this.token = null;
    this.refCount = 0;
    this.attempts = 0;
    this.hasConnectedOnce = false;
    this.dropped = false;
    if (wasConnected) this.emit('disconnected');
  }
}

export const stompClient = new StompClient();
