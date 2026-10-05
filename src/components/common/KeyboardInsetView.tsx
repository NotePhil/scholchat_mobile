import React, { ReactNode, useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';

/**
 * App-wide replacement for Android's old "adjustResize".
 *
 * On recent Android (edge-to-edge, Android 15/16) the window is no longer
 * resized when the keyboard opens, so the keyboard simply covers whatever is
 * at the bottom of every screen. Wrapping the app in this view gives it a
 * bottom padding equal to the keyboard height while the keyboard is open:
 * every screen then lays out above the keyboard, and native ScrollViews
 * scroll the focused field into view on their own.
 *
 * iOS is untouched (screens there use KeyboardAvoidingView as usual).
 * Note: RN <Modal>s are separate windows and are not covered by this.
 */
const KeyboardInsetView = ({ children }: { children: ReactNode }) => {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setInset(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return <View style={{ flex: 1, paddingBottom: inset }}>{children}</View>;
};

export default KeyboardInsetView;
