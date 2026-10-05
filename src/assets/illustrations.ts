import type { ImageSourcePropType } from 'react-native';
import { IllustrationName as VectorName, illustrationRegistry } from '../components/illustrations/registry';

/**
 * Every illustration used by the pre-login experience (onboarding, auth flows).
 *
 * Designer artworks (PNG, transparent background) are used where they exist;
 * the others fall back to the vector artworks drawn with react-native-svg
 * (src/components/illustrations/). To swap an artwork, replace the PNG with a
 * same-named file (ideally ~1000 px wide, transparent background) — no code
 * change needed unless its proportions change (then update width/height here).
 */
export type IllustrationName = VectorName | 'community';

interface RasterIllustration {
  light: ImageSourcePropType;
  /** Optional dark-mode variant; the light one is used otherwise. */
  dark?: ImageSourcePropType;
  width: number;
  height: number;
}

export const rasterIllustrations: Partial<Record<IllustrationName, RasterIllustration>> = {
  onboarding1: { light: require('../../assets/illustrations/onboarding-1.png'), width: 453, height: 350 },
  onboarding2: { light: require('../../assets/illustrations/onboarding-2.png'), width: 435, height: 326 },
  onboarding3: { light: require('../../assets/illustrations/onboarding-3.png'), width: 461, height: 352 },
  onboarding4: { light: require('../../assets/illustrations/onboarding-4.png'), width: 452, height: 283 },
  community: { light: require('../../assets/illustrations/community.png'), width: 531, height: 305 },
  loginHero: {
    light: require('../../assets/illustrations/login-hero.png'),
    dark: require('../../assets/illustrations/login-hero-dark.png'),
    width: 410,
    height: 250,
  },
  accountCreated: {
    light: require('../../assets/illustrations/account-created.png'),
    dark: require('../../assets/illustrations/account-created-dark.png'),
    width: 313,
    height: 273,
  },
};

/** Intrinsic aspect ratios (width / height) of the illustrations, so they can be laid out up-front. */
export const illustrationRatios = {
  ...Object.fromEntries(Object.entries(illustrationRegistry).map(([k, v]) => [k, v.width / v.height])),
  ...Object.fromEntries(Object.entries(rasterIllustrations).map(([k, v]) => [k, v!.width / v!.height])),
} as Record<IllustrationName, number>;
