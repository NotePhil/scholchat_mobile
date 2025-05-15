// App.js
import React, { useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import AuthModal from './src/components/common/AuthModal';

const App = () => {
  const [showAuth, setShowAuth] = useState(false);

  const handleSignIn = (email, password) => {
    console.log('Signing in with:', email, password);
    setShowAuth(false);
  };

  const handleSignUp = (formData) => {
    console.log('Signing up with:', formData);
    setShowAuth(false);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <MainTabNavigator onLoginPress={() => setShowAuth(true)} />
      </NavigationContainer>
      <AuthModal
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
    </SafeAreaView>
  );
};

export default App;