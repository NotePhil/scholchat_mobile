import React, { memo, useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { usePoppinsStore } from '../brand/fonts';
import { makeTheme } from './kit';
import { IllustrationName, illustrationRegistry } from './registry';

export { illustrationRegistry } from './registry';
export type { IllustrationName } from './registry';

const POPPINS = { regular: 'Poppins_400Regular', semibold: 'Poppins_600SemiBold', bold: 'Poppins_700Bold' };

export interface VectorIllustrationProps {
  /** Rendered width; the height follows the artwork's fixed aspect ratio. */
  width: number;
  /** Dark-mode palette for the soft background blob, cards and decorations. */
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Crisp vector illustration (react-native-svg). The markup is generated once per
 * name / theme / font state and memoised, so re-renders only resize the SVG.
 */
export const VectorIllustration = memo(({ name, width, dark = false, style }: VectorIllustrationProps & { name: IllustrationName }) => {
  const fontsReady = usePoppinsStore((s) => s.ready);
  const spec = illustrationRegistry[name];
  const xml = useMemo(() => spec.build(makeTheme({ dark, fontFamilies: fontsReady ? POPPINS : undefined })), [spec, dark, fontsReady]);
  return <SvgXml xml={xml} width={width} height={(width * spec.height) / spec.width} style={style} />;
});
VectorIllustration.displayName = 'VectorIllustration';

const named = (name: IllustrationName) => {
  const C = (props: VectorIllustrationProps) => <VectorIllustration name={name} {...props} />;
  C.displayName = `${name}Illustration`;
  return C;
};

export const Onboarding1Illustration = named('onboarding1');
export const Onboarding2Illustration = named('onboarding2');
export const Onboarding3Illustration = named('onboarding3');
export const Onboarding4Illustration = named('onboarding4');
export const LoginHeroIllustration = named('loginHero');
export const ForgotPasswordIllustration = named('forgotPassword');
export const NewPasswordIllustration = named('newPassword');
export const AccountCreatedIllustration = named('accountCreated');
