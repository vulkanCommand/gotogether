import 'expo-dev-client';
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getIdToken, onIdTokenChanged } from '@react-native-firebase/auth';
import AppNavigator from './src/navigation/AppNavigator';
import { RootStackParamList } from './src/navigation/AppNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from './src/theme/colors';
import { firebaseAuth } from './src/config/firebase';
import { useAuthStore } from './src/store/authStore';
import { syncAuthenticatedUser } from './src/config/api';
import { attachNotificationNavigation, ensurePushRegistration } from './src/services/notifications';

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

const linking = {
  prefixes: ['gotogether://', 'https://gotogether.app'],
  config: {
    screens: {
      TripInvite: 'trip-invite/:token',
    },
  },
};

function AuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setAuthChecked = useAuthStore((state) => state.setAuthChecked);
  const setUser = useAuthStore((state) => state.setUser);
  const cachedUser = useAuthStore((state) => state.user);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (user) => {
      if (!user) {
        clearSession();
        setAuthChecked(true);
        return;
      }

      try {
        const freshToken = await getIdToken(user);
        setSession(freshToken);
        setAuthChecked(true);

        syncAuthenticatedUser()
          .then((response) => {
            setUser(response.user);
          })
          .catch((error) => {
            console.log('Profile sync failed', error);

            if (!useAuthStore.getState().user && !cachedUser) {
              clearSession();
            }
          });
      } catch (error) {
        console.log('Auth bootstrap failed', error);

        if (!useAuthStore.getState().user && !cachedUser) {
          clearSession();
        }

        setAuthChecked(true);
      }
    });

    return unsubscribe;
  }, [cachedUser, clearSession, setAuthChecked, setSession, setUser]);

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
        if (!mounted || !user?.id) {
          return;
        }
        await ensurePushRegistration(user.id);
      } catch (error) {
        console.log('Push registration failed', error);
      }
    };

    setupPush();

    const subscription = attachNotificationNavigation(navigationRef);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [token, user?.id]);

  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme} ref={navigationRef} linking={linking}>
          <AuthBootstrap />
          <PushBootstrap />
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
