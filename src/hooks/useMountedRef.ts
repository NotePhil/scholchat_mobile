import { useEffect, useRef } from 'react';

/**
 * `ref.current` is true while the component is mounted. For async work started by an effect that
 * clears its own trigger (useUiStore pending requests from a notification tap): clearing the
 * trigger re-runs the effect, so a cleanup-based "cancelled" flag would drop the result.
 */
export const useMountedRef = () => {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
};
