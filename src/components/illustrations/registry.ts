import { accountCreated, forgotPassword, loginHero, newPassword } from './auth';
import { Theme } from './kit';
import { onboarding1, onboarding2, onboarding3, onboarding4 } from './onboarding';

export interface IllustrationSpec {
  /** viewBox size of the artwork (its aspect ratio is width / height). */
  width: number;
  height: number;
  build: (t: Theme) => string;
}

/** Every vector illustration of the pre-login experience, by name. Pure TS (no React Native import). */
export const illustrationRegistry = {
  onboarding1: { width: 400, height: 370, build: onboarding1 },
  onboarding2: { width: 400, height: 370, build: onboarding2 },
  onboarding3: { width: 400, height: 370, build: onboarding3 },
  onboarding4: { width: 400, height: 370, build: onboarding4 },
  loginHero: { width: 400, height: 160, build: loginHero },
  forgotPassword: { width: 240, height: 160, build: forgotPassword },
  newPassword: { width: 200, height: 160, build: newPassword },
  accountCreated: { width: 300, height: 254, build: accountCreated },
} satisfies Record<string, IllustrationSpec>;

export type IllustrationName = keyof typeof illustrationRegistry;
