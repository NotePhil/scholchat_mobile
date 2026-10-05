import { useEffect } from 'react';
import { storageService } from '../services/storageService';
import { stompClient } from '../services/realtime/stompClient';
import { emitMessagesStream, useMessagesStore } from '../store/useMessagesStore';
import { MessageRealtimeEvent } from '../types';

/**
 * App-wide messages realtime: subscribes /topic/messages/{userId} on the
 * shared STOMP connection, keeps the footer unread badge live even off the
 * Messages screen, and forwards every event to the open Messages screen via
 * subscribeMessagesStream. After a reconnect it re-fetches the unread count
 * once and emits RESYNC so the screen reloads its lists once. No polling.
 * Mount once (AppHeader).
 */
export const useMessagesRealtime = (userId?: string | null) => {
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let release: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;
    let offConn: (() => void) | null = null;
    const store = useMessagesStore.getState();

    store.refresh(userId);
    storageService
      .getUserToken()
      .catch(() => null)
      .then((token) => {
        if (disposed) return;
        release = stompClient.connect(token, userId);
        unsubscribe = stompClient.subscribe(`/topic/messages/${userId}`, (body) => {
          const event = body as MessageRealtimeEvent | null;
          if (!event || typeof event !== 'object' || !event.type || !event.message) return;
          const msg = event.message;
          const isIncomingUnread = msg.expediteur?.id !== userId && msg.lu === false;
          if (event.type === 'NEW_MESSAGE') {
            if (isIncomingUnread) {
              const { unreadCount, setUnreadCount } = useMessagesStore.getState();
              setUnreadCount(unreadCount + 1);
            }
          } else if (event.type === 'MESSAGE_DELETED' || event.type === 'MESSAGE_RESTORED') {
            // The delete payload doesn't say whether it was unread — recompute from the server.
            useMessagesStore.getState().refresh(userId);
          }
          emitMessagesStream(event);
        });
        offConn = stompClient.onConnectionEvent((evt) => {
          if (evt !== 'reconnected') return;
          useMessagesStore.getState().refresh(userId);
          emitMessagesStream({ type: 'RESYNC' });
        });
      });

    return () => {
      disposed = true;
      offConn?.();
      unsubscribe?.();
      release?.();
      useMessagesStore.getState().reset();
    };
  }, [userId]);
};
