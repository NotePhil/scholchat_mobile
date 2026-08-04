// src/navigation/AppNavigator.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/Home/HomeScreen';
import AboutScreen from '../screens/Home/AboutScreen';
import FAQScreen from '../screens/Home/FAQScreen';
import ProductsScreen from '../screens/Home/ProductsScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home">
        {(props) => <HomeScreen {...props} onLoginPress={() => {}} />}
      </Stack.Screen>
      <Stack.Screen name="About">
        {(props) => <AboutScreen {...props} onLoginPress={() => {}} />}
      </Stack.Screen>
      <Stack.Screen name="FAQ">
        {(props) => <FAQScreen {...props} onLoginPress={() => {}} />}
      </Stack.Screen>
      <Stack.Screen name="Products">
        {(props) => <ProductsScreen {...props} onLoginPress={() => {}} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AppNavigator;
