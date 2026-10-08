import { useCallback, useEffect } from 'react';
import { notificationService, normalizeNotification } from '../services/api/notificationService';
import { storageService } from '../services/storageService';
import { stompClient } from '../services/realtime/stompClient';
import { useNotificationsStore } from '../store/useNotificationsStore';
import { isChildAccessNotification } from '../services/notificationRouting';
import { refreshParentAccess } from '../services/parentAccess';

/**
 * Keeps the notification store live for the logged-in user:
 *  - initial fetch,
 *  - real-time push on /topic/notifications/{userId} over the app's single
 *    shared STOMP connection (services/realtime/stompClient),
 *  - ONE catch-up re-fetch after the socket reconnects (it dropped, e.g. the
 *    app was backgrounded or the network flapped) — no polling.
 * Mount it once (AppHeader, which lives for the whole dashboard session).
 */
export const useNotificationsRealtime = (userId?: string | null) => {
  const setItems = useNotificationsStore((s) => s.setItems);
  const upsert = useNotificationsStore((s) => s.upsert);

  const refresh = useCallback(async () => {
    try {
      const list = await notificationService.getAll();
      setItems(list);
    } catch {
      // best-effort — keep what we have
    }
  }, [setItems]);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let release: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;
    let offConn: (() => void) | null = null;

    refresh();
    storageService
      .getUserToken()
      .catch(() => null)
      .then((token) => {
        if (disposed) return;
        release = stompClient.connect(token, userId);
        unsubscribe = stompClient.subscribe(`/topic/notifications/${userId}`, (body) => {
          if (!body || typeof body !== 'object') return;
          try {
            const item = normalizeNotification(body as Record<string, unknown>);
            upsert(item);
            // A child's class request was decided: refresh the parent's access (may unlock the app).
            if (isChildAccessNotification(item.type)) refreshParentAccess();
          } catch {
            // malformed payload — ignore
          }
        });
        offConn = stompClient.onConnectionEvent((event) => {
          if (event === 'reconnected') refresh();
        });
      });

    return () => {
      disposed = true;
      offConn?.();
      unsubscribe?.();
      release?.();
      // Logged out / user changed: don't leak the previous user's list or badge.
      useNotificationsStore.getState().reset();
    };
  }, [userId, refresh, upsert]);

  return { refresh };
};
