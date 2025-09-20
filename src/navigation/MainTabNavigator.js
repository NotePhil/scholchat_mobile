import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeScreen from "../screens/HomeScreen";
import AboutScreen from "../screens/AboutScreen";
import FAQScreen from "../screens/FAQScreen";
import ProductsScreen from "../screens/ProductsScreen";
import DashboardScreen from "../screens/professeurs/DashboardScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack Navigator for Dashboard (you can add more dashboard-related screens here)
const DashboardStack = ({ onLogout }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard">
        {(props) => <DashboardScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

// Main Tab Navigator for public screens
const PublicTabNavigator = ({ onLoginPress, onNavigateToDashboard }) => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "About") {
            iconName = focused
              ? "information-circle"
              : "information-circle-outline";
          } else if (route.name === "FAQ") {
            iconName = focused ? "help-circle" : "help-circle-outline";
          } else if (route.name === "Products") {
            iconName = focused ? "cube" : "cube-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#4F46E5",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          paddingBottom: insets.bottom + 5,
          height: 60 + insets.bottom,
          backgroundColor: "#FFFFFF",
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home">
        {(props) => (
          <HomeScreen
            {...props}
            onLoginPress={onLoginPress}
            onNavigateToDashboard={onNavigateToDashboard}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="About">
        {(props) => (
          <AboutScreen
            {...props}
            onLoginPress={onLoginPress}
            onNavigateToDashboard={onNavigateToDashboard}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Products">
        {(props) => (
          <ProductsScreen
            {...props}
            onLoginPress={onLoginPress}
            onNavigateToDashboard={onNavigateToDashboard}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="FAQ">
        {(props) => (
          <FAQScreen
            {...props}
            onLoginPress={onLoginPress}
            onNavigateToDashboard={onNavigateToDashboard}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const MainTabNavigator = ({
  showDashboard,
  onLoginPress,
  onLogout,
  onNavigateToDashboard,
}) => {
  if (showDashboard) {
    return <DashboardStack onLogout={onLogout} />;
  }
  return (
    <PublicTabNavigator
      onLoginPress={onLoginPress}
      onNavigateToDashboard={onNavigateToDashboard}
    />
  );
};

export default MainTabNavigator;
