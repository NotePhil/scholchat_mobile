import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RoleChoiceScreen from '../screens/auth/RoleChoiceScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

const Stack = createStackNavigator();

/**
 * Logged-out experience: first-launch onboarding, login, role choice ("Je suis…") and the
 * role sign-up flows (same account types as web SignUp.jsx).
 * Screens shared with emailed links or reached from several flows (ForgotPassword,
 * ResetPassword, AccountCreated, VerifyEmail…) live on the root stack in
 * RootNavigator so they can be deep-linked without route name collisions.
 */
const AuthNavigator = ({ showOnboarding = false }: { showOnboarding?: boolean }) => (
  <Stack.Navigator
    initialRouteName={showOnboarding ? 'Onboarding' : 'Login'}
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="RoleChoice" component={RoleChoiceScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;
