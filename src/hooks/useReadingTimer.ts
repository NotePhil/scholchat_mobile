import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/** Same cap as the backend (CoursBusiness.DUREE_LECTURE_MAX_SECONDES): 4 h. */
export const MAX_READING_SECONDS = 4 * 3600;

/**
 * Active reading time of a course's chapters, sent with "Marquer comme terminé".
 *
 * The clock only runs while the screen is focused and the app is in the foreground. A chapter's
 * time is measured from its first opening — or from the previous "Marquer comme terminé" click if
 * that is more recent — to the click (falls back to the screen opening when the chapter was never
 * expanded). Capped at 4 h.
 */
export const useReadingTimer = () => {
  const accumulated = useRef(0);
  const runningSince = useRef<number | null>(Date.now());
  const openedAt = useRef<Record<string, number>>({});
  const lastMark = useRef(0);

  const now = useCallback(
    () => accumulated.current + (runningSince.current != null ? Date.now() - runningSince.current : 0),
    []
  );
  const pause = useCallback(() => {
    if (runningSince.current != null) {
      accumulated.current += Date.now() - runningSince.current;
      runningSince.current = null;
    }
  }, []);
  const resume = useCallback(() => {
    if (runningSince.current == null) runningSince.current = Date.now();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => (state === 'active' ? resume() : pause()));
    return () => sub.remove();
  }, [pause, resume]);

  useFocusEffect(
    useCallback(() => {
      resume();
      return () => pause();
    }, [pause, resume])
  );

  /** A chapter became visible (expanded): its clock starts at the first opening. */
  const markOpened = useCallback(
    (key: string) => {
      if (openedAt.current[key] == null) openedAt.current[key] = now();
    },
    [now]
  );

  /** Seconds to send for this chapter (not consumed until `commit`). */
  const peek = useCallback(
    (key: string) => {
      const start = Math.max(openedAt.current[key] ?? 0, lastMark.current);
      return Math.min(MAX_READING_SECONDS, Math.max(0, Math.round((now() - start) / 1000)));
    },
    [now]
  );

  /** The completion was saved: the next chapter's time starts now. */
  const commit = useCallback(() => {
    lastMark.current = now();
  }, [now]);

  return { markOpened, peek, commit };
};
