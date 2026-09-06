import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

const Stack = createStackNavigator();

/**
 * Logged-out experience: Login & SignUp screens.
 * Sibling screens like ForgotPassword, ResetPassword, VerifyEmail, etc.
 * live on the root stack in RootNavigator so they can be deep-linked
 * or navigated to without route name collisions.
 */
const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;
