import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { UserProvider } from './src/context/UserContext';
import SessionExpiredModal from './src/components/modals/SessionExpiredModal';
import KeyboardInsetView from './src/components/common/KeyboardInsetView';

const App = () => (
  <UserProvider>
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <KeyboardInsetView>
        <RootNavigator />
      </KeyboardInsetView>
      <SessionExpiredModal />
    </SafeAreaProvider>
  </UserProvider>
);

export default App;
