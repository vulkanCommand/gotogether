import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onIdTokenChanged } from 'firebase/auth';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';
import { firebaseAuth } from './src/config/firebase';
import { useAuthStore } from './src/store/authStore';
import { syncAuthenticatedUser } from './src/config/api';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

function AuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setAuthChecked = useAuthStore((state) => state.setAuthChecked);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (user) => {
      try {
        if (!user) {
          clearSession();
          return;
        }

        const freshToken = await user.getIdToken(true);
        setSession(freshToken);
        const response = await syncAuthenticatedUser();
        setUser(response.user);
      } catch (error) {
        console.log('Auth bootstrap failed', error);
        clearSession();
      } finally {
        setAuthChecked(true);
      }
    });

    return unsubscribe;
  }, [clearSession, setAuthChecked, setSession, setUser]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <AuthBootstrap />
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
