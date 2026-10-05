import { createContext, useContext } from 'react';

/** Boot state computed once in RootNavigator: fonts + first-launch onboarding flag (the session lives in useAuthStore). */
export interface BootState {
  ready: boolean;
  fontsReady: boolean;
  showOnboarding: boolean;
  /** Called by the onboarding when it finishes (the flag is also persisted by storageService). */
  onboardingDone: () => void;
}

export const BootContext = createContext<BootState>({
  ready: false,
  fontsReady: false,
  showOnboarding: false,
  onboardingDone: () => {},
});

export const useBoot = () => useContext(BootContext);
