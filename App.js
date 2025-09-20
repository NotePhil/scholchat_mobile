import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import MainTabNavigator from "./src/navigation/MainTabNavigator";
import AuthModal from "./src/components/common/AuthModal";

const App = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const handleNavigateToDashboard = () => {
    console.log("Navigating to dashboard...");
    setShowDashboard(true);
    setShowAuth(false);
  };

  const handleSignUp = (formData) => {
    console.log("Signing up with:", formData);
    setShowDashboard(true);
    setShowAuth(false);
  };

  const handleLogout = () => {
    console.log("Logging out...");
    setShowDashboard(false);
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <MainTabNavigator
          showDashboard={showDashboard}
          onLoginPress={() => setShowAuth(true)}
          onLogout={handleLogout}
          onNavigateToDashboard={handleNavigateToDashboard} // Add this line
        />
      </NavigationContainer>
      <AuthModal
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onNavigateToDashboard={handleNavigateToDashboard}
        onSignUp={handleSignUp}
      />
    </SafeAreaProvider>
  );
};

export default App;
