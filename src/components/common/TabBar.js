import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../../screens/HomeScreen';
import AboutScreen from '../../screens/AboutScreen';
import FAQScreen from '../../screens/FAQScreen';
import ProductsScreen from '../../screens/ProductsScreen';

const Tab = createBottomTabNavigator();

const TabBar = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'About') {
            iconName = focused ? 'information-circle' : 'information-circle-outline';
          } else if (route.name === 'FAQ') {
            iconName = focused ? 'help-circle' : 'help-circle-outline';
          } else if (route.name === 'Products') {
            iconName = focused ? 'cube' : 'cube-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Accueil' }} 
      />
      <Tab.Screen 
        name="About" 
        component={AboutScreen} 
        options={{ title: 'À propos' }} 
      />
      <Tab.Screen 
        name="Products" 
        component={ProductsScreen} 
        options={{ title: 'Produits' }} 
      />
      <Tab.Screen 
        name="FAQ" 
        component={FAQScreen} 
        options={{ title: 'FAQ' }} 
      />
    </Tab.Navigator>
  );
};

export default TabBar;