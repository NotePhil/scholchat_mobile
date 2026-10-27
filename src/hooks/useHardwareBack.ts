import { useContext, useEffect, useRef } from 'react';
import { BackHandler, NativeEventSubscription } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

/**
 * Android hardware Back inside the dashboard's in-screen view stacks (class list → class detail →
 * course detail, conversation list → chat, exercise list → detail…). Those sub-views are plain
 * component state, not navigator screens, so without this Back reaches the navigator, which has
 * nothing to pop on the dashboard and exits the app.
 *
 * Every active handler is kept in one stack, ordered by when it became active: the most recently
 * opened sub-view closes first, and one press closes exactly one level. Handlers of a screen that
 * isn't focused (e.g. Notifications or the course viewer pushed on top of the dashboard) are
 * skipped so the navigator pops that screen as usual. Modals handle Back themselves
 * (onRequestClose) and never reach this.
 */
type Entry = { run: () => boolean; priority: number; seq: number };

const stack: Entry[] = [];
let subscription: NativeEventSubscription | null = null;
let nextSeq = 0;

const onHardwareBack = () => {
  // Highest priority first, then the most recently activated.
  const ordered = [...stack].sort((a, b) => b.priority - a.priority || b.seq - a.seq);
  return ordered.some((entry) => entry.run());
};

/**
 * `handler` runs on Back while `enabled` is true (return `false` from it to let Back go on to the
 * next level). Typical use: `useHardwareBack(() => setSelected(null), !!selected)`. `priority`
 * below 0 is for app-level fallbacks (the dashboard's "back to the first tab") that must only run
 * when no sub-view is open.
 */
export const useHardwareBack = (
  handler: (() => boolean | void) | null | undefined,
  enabled = true,
  priority = 0
) => {
  const navigation = useContext(NavigationContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const active = enabled && !!handler;

  useEffect(() => {
    if (!active) return undefined;
    nextSeq += 1;
    const entry: Entry = {
      priority,
      seq: nextSeq,
      run: () => {
        const nav = navigationRef.current;
        if (nav && typeof nav.isFocused === 'function' && !nav.isFocused()) return false;
        const fn = handlerRef.current;
        if (!fn) return false;
        return fn() !== false;
      },
    };
    stack.push(entry);
    if (!subscription) subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => {
      const index = stack.indexOf(entry);
      if (index >= 0) stack.splice(index, 1);
      if (stack.length === 0 && subscription) {
        subscription.remove();
        subscription = null;
      }
    };
  }, [active, priority]);
};
