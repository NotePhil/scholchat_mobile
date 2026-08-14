import React, { useEffect } from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/useAuthStore';
import { AppRole } from '../types';
import AuthNavigator from './AuthNavigator';
import DashboardShell from '../screens/shared/DashboardShell';
import ComingSoonScreen from '../screens/shared/ComingSoonScreen';
import { LoadingSpinner } from '../components/ui';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import AccountActivationScreen from '../screens/auth/AccountActivationScreen';
import SetPasswordScreen from '../screens/auth/SetPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ClassApprovalScreen from '../screens/auth/ClassApprovalScreen';
import ClassRejectionScreen from '../screens/auth/ClassRejectionScreen';
import RenewalScreen from '../screens/auth/RenewalScreen';
import LiveSessionScreen from '../screens/shared/LiveSessionScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';

const Stack = createStackNavigator();

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrateur',
  professor: 'Professeur',
  parent: 'Parent',
  student: 'Élève',
  establishment: 'Établissement',
  gestionnaire: 'Gestionnaire',
  tutor: 'Répétiteur',
  unknown: 'Utilisateur',
};

/** The always-mounted "what's the current session state" screen — swaps between loading/role-dashboard/login. */
const AppShell = () => {
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Chargement..." />;
  }

  if (!isAuthenticated) {
    return <AuthNavigator />;
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
      return <ComingSoonScreen roleLabel={ROLE_LABELS[role]} />;
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
      ClassApproval: 'scholchat/etablissements/approve-class/:etablissementId/:classeId',
      ClassRejection: 'schoolchat/class-rejection/:classeId/:etablissementId',
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

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="App" component={AppShell} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="AccountActivation" component={AccountActivationScreen} />
        <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="ClassApproval" component={ClassApprovalScreen} />
        <Stack.Screen name="ClassRejection" component={ClassRejectionScreen} />
        <Stack.Screen name="Renewal" component={RenewalScreen} />
        <Stack.Screen name="LiveSession" component={LiveSessionScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
