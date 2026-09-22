import { useCallback, useRef } from 'react';
import { FocusEvent, ScrollView } from 'react-native';

/**
 * Scrolls the focused TextInput above the keyboard. Plain KeyboardAvoidingView
 * only shrinks the screen; it never moves a field that's still below the fold
 * back into view, which is what let the keyboard cover SignUp's lower fields.
 * Attach `scrollRef` to the form's ScrollView and spread each TextInput's
 * onFocus with `onFocus={(e) => { ...; scrollToFocusedInput(e); }}`.
 */
export function useKeyboardAwareScroll(extraOffset = 24) {
  const scrollRef = useRef<ScrollView>(null);

  const scrollToFocusedInput = useCallback(
    (event: FocusEvent) => {
      const target = event.target;
      const scroller = scrollRef.current;
      if (!target || !scroller) return;

      // Deferred so the keyboard's show animation has already started sizing
      // the screen by the time we measure the field's position within it.
      requestAnimationFrame(() => {
        target.measureLayout(
          scroller.getInnerViewNode(),
          (_left: number, top: number) => {
            scroller.scrollTo({ y: Math.max(top - extraOffset, 0), animated: true });
          },
          () => {}
        );
      });
    },
    [extraOffset]
  );

  return { scrollRef, scrollToFocusedInput };
}
