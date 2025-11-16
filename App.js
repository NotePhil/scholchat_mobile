import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import MainTabNavigator from "./src/navigation/MainTabNavigator";
import AuthModal from "./src/components/common/AuthModal";
import AdminDashboard from "./src/screens/admin/components/AdminDashboard";

const App = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  const handleNavigateToDashboard = () => {
    console.log("Navigating to professor dashboard...");
    setShowDashboard(true);
    setShowAuth(false);
  };

  const handleNavigateToAdmin = () => {
    console.log("Navigating to admin dashboard...");
    setShowAdminDashboard(true);
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
    setShowAdminDashboard(false);
  };

  if (showAdminDashboard) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <AdminDashboard onLogout={handleLogout} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <MainTabNavigator
          showDashboard={showDashboard}
          onLoginPress={() => setShowAuth(true)}
          onLogout={handleLogout}
          onNavigateToDashboard={handleNavigateToDashboard}
        />
      </NavigationContainer>
      <AuthModal
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onNavigateToDashboard={handleNavigateToDashboard}
        onNavigateToAdmin={handleNavigateToAdmin}
        onSignUp={handleSignUp}
      />
    </SafeAreaProvider>
  );
};

export default App;
