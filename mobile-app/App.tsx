import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onIdTokenChanged } from 'firebase/auth';
import AppNavigator from './src/navigation/AppNavigator';
import { RootStackParamList } from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';
import { firebaseAuth } from './src/config/firebase';
import { useAuthStore } from './src/store/authStore';
import { registerPushToken, syncAuthenticatedUser } from './src/config/api';
import {
  addNotificationResponseListener,
  registerForPushNotificationsAsync,
} from './src/config/pushNotifications';

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

const navigationRef = createNavigationContainerRef<RootStackParamList>();

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

function PushBootstrap() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let mounted = true;

    const setupPush = async () => {
      try {
        const expoPushToken = await registerForPushNotificationsAsync();
        if (!mounted || !expoPushToken) {
          return;
        }
        await registerPushToken({
          token: expoPushToken,
          platform: 'expo',
        });
      } catch (error) {
        console.log('Push registration failed', error);
      }
    };

    setupPush();

    const subscription = addNotificationResponseListener(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Notifications');
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [token, user]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} ref={navigationRef}>
        <AuthBootstrap />
        <PushBootstrap />
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
