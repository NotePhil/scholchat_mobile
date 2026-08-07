import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

const Stack = createStackNavigator();

/**
 * Logged-out experience: straight to a full-page Login screen (no marketing
 * tabs) per explicit product decision — the mobile app is direct, not a
 * public site. SignUp is one tap away; ForgotPassword/ResetPassword etc.
 * live as siblings on RootNavigator's outer stack since they're also
 * reachable from emailed links regardless of auth state.
 */
const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;
