// src/navigation/AppNavigator.js
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
        animationEnabled: true
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="FAQ" component={FAQScreen} />
      <Stack.Screen name="Products" component={ProductsScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;