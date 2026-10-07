import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BootContext, useBoot } from './bootContext';
import { useFonts } from 'expo-font';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useLanguageStore } from '../store/useLanguageStore';
import AuthNavigator from './AuthNavigator';
import DashboardShell from '../screens/shared/DashboardShell';
import ComingSoonScreen from '../screens/shared/ComingSoonScreen';
import { poppinsFonts, setPoppinsReady } from '../components/brand';
import { usePoppinsStore } from '../components/brand/fonts';
import { storageService } from '../services/storageService';
import SplashScreen from '../screens/auth/SplashScreen';
import ForceChangePasswordScreen from '../screens/auth/ForceChangePasswordScreen';
import AccountCreatedScreen from '../screens/auth/AccountCreatedScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import AccountActivationScreen from '../screens/auth/AccountActivationScreen';
import SetPasswordScreen from '../screens/auth/SetPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import VerifyAccountScreen from '../screens/auth/VerifyAccountScreen';
import ClassApprovalScreen from '../screens/auth/ClassApprovalScreen';
import ClassRejectionScreen from '../screens/auth/ClassRejectionScreen';
import RenewalScreen from '../screens/auth/RenewalScreen';
import LiveSessionScreen from '../screens/shared/LiveSessionScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import ExerciseAttemptScreen from '../screens/student/ExerciseAttemptScreen';
import ExerciseResultScreen from '../screens/student/ExerciseResultScreen';
import CourseViewerScreen from '../screens/shared/CourseViewerScreen';
import PdfViewerScreen from '../screens/shared/PdfViewerScreen';

const Stack = createStackNavigator();

/** Minimum time the animated splash stays up, so its entrance animation isn't cut off. */
const MIN_SPLASH_MS = 1400;

/** The always-mounted "what's the current session state" screen — swaps between splash/role-dashboard/login. */
const AppShell = () => {
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);
  const logout = useAuthStore((state) => state.logout);
  const boot = useBoot();

  if (isLoading || !boot.ready) {
    return <SplashScreen fontsReady={boot.fontsReady} />;
  }

  if (!isAuthenticated) {
    return <AuthNavigator showOnboarding={boot.showOnboarding} />;
  }

  // First login with the e-mailed temporary password: a new password first, whatever the role.
  if (mustChangePassword) {
    return <ForceChangePasswordScreen />;
  }

  switch (role) {
    case 'admin':
    case 'professor':
    case 'tutor':
    case 'parent':
    case 'student':
    case 'establishment':
    case 'gestionnaire':
      return <DashboardShell onLogout={logout} />;
    default:
      return <ComingSoonScreen role={role} />;
  }
};

// Maps the same emailed-link URL paths the web app uses (scholchat_front's
// App.js routes) to mobile stack screens, so links sent by the backend keep
// working when opened on a device with this app installed.
const linking: LinkingOptions<Record<string, unknown>> = {
  prefixes: ['scholchat://'],
  config: {
    screens: {
      App: 'home',
      ForgotPassword: 'schoolchat/forgot-password',
      ResetPassword: 'schoolchat/reset-password',
      AccountActivation: 'schoolchat/account-activation',
      VerifyEmail: 'schoolchat/verify-email',
      // The backend e-mails /schoolchat/class-approval|class-rejection?classeId=&etablissementId=&token=&nom=
      // (query params become route params); the path-segment forms are older links.
      ClassApproval: {
        path: 'schoolchat/class-approval',
        alias: [
          'schoolchat/class-approval/:classeId/:etablissementId',
          // Legacy link; segments forwarded in the order received, like the web page does.
          'scholchat/etablissements/approve-class/:classeId/:etablissementId',
        ],
      },
      ClassRejection: {
        path: 'schoolchat/class-rejection',
        alias: ['schoolchat/class-rejection/:classeId/:etablissementId'],
      },
      Renewal: 'schoolchat/renouveler-offre',
    },
  },
};

/**
 * Top-level stack: "App" is the session-state-driven shell (login screen or
 * role dashboard). The rest are standalone, no-login screens reached via
 * emailed links or from LoginScreen's "forgot password" — registered here
 * (not inside AuthNavigator) so they work regardless of auth state.
 */
const RootNavigator = () => {
  const hydrate = useAuthStore((state) => state.hydrate);
  const loadThemeMode = useThemeStore((state) => state.loadMode);
  const loadLanguage = useLanguageStore((state) => state.loadLanguage);
  const languageLoaded = useLanguageStore((state) => state.loaded);
  const [fontsLoaded, fontError] = useFonts(poppinsFonts);
  const fontsReady = fontsLoaded || !!fontError;
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    hydrate();
    // Loaded here (not just in AppHeader) so pre-login screens also reflect
    // a previously-saved choice or the phone's system setting immediately.
    loadThemeMode();
    // Saved language (or device locale) before the first pre-login screen renders.
    loadLanguage();
    storageService.hasSeenOnboarding().then((seen) => {
      setShowOnboarding(!seen);
      setOnboardingChecked(true);
    });
    const t = setTimeout(() => setMinSplashDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [hydrate, loadThemeMode, loadLanguage]);

  // Poppins when available; if loading failed the brand styles fall back to system weights.
  const poppinsApplied = usePoppinsStore((s) => s.ready);
  useEffect(() => {
    setPoppinsReady(fontsLoaded);
  }, [fontsLoaded]);
  const onboardingDone = useCallback(() => setShowOnboarding(false), []);
  const ready = (poppinsApplied || !!fontError) && onboardingChecked && minSplashDone && languageLoaded;
  const boot = useMemo(
    () => ({ ready, fontsReady, showOnboarding, onboardingDone }),
    [ready, fontsReady, showOnboarding, onboardingDone]
  );

  return (
    <BootContext.Provider value={boot}>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="App" component={AppShell} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="AccountCreated" component={AccountCreatedScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="AccountActivation" component={AccountActivationScreen} />
          <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="VerifyAccount" component={VerifyAccountScreen} />
          <Stack.Screen name="ClassApproval" component={ClassApprovalScreen} />
          <Stack.Screen name="ClassRejection" component={ClassRejectionScreen} />
          <Stack.Screen name="Renewal" component={RenewalScreen} />
          <Stack.Screen name="LiveSession" component={LiveSessionScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="ExerciseAttempt" component={ExerciseAttemptScreen} />
          <Stack.Screen name="ExerciseResult" component={ExerciseResultScreen} />
          <Stack.Screen name="CourseViewer" component={CourseViewerScreen} />
          <Stack.Screen name="PdfViewer" component={PdfViewerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </BootContext.Provider>
  );
};

export default RootNavigator;
