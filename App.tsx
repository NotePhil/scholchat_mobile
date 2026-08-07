import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { UserProvider } from './src/context/UserContext';

const App = () => (
  <UserProvider>
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <RootNavigator />
    </SafeAreaProvider>
  </UserProvider>
);

export default App;
