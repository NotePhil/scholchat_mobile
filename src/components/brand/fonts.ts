import { TextStyle } from 'react-native';
import { create } from 'zustand';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';

/**
 * Poppins (design boards' typeface), loaded through expo-font (part of the Expo SDK, no extra
 * native module). Only the four weights the boards use are bundled. Loaded once in
 * RootNavigator while the animated splash is visible.
 */
export const poppinsFonts = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

const FAMILY = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

const WEIGHT: Record<keyof typeof FAMILY, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

/** Whether Poppins is loaded. Brand palettes (useBrandColors) change identity when it flips, so memoised styles rebuild. */
export const usePoppinsStore = create<{ ready: boolean }>(() => ({ ready: false }));

/** Called by RootNavigator (in an effect) once the fonts are loaded; if loading failed, system fonts stay in use. */
export const setPoppinsReady = (ready: boolean) => {
  if (usePoppinsStore.getState().ready !== ready) usePoppinsStore.setState({ ready });
};

/**
 * Font style for a weight: the Poppins face when loaded, otherwise the system font at the
 * same weight. Call it when building styles inside a component (not at module load).
 */
export const ff = (weight: keyof typeof FAMILY = 'regular'): TextStyle =>
  usePoppinsStore.getState().ready ? { fontFamily: FAMILY[weight] } : { fontWeight: WEIGHT[weight] };
