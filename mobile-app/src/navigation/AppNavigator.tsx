import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import PermissionsSetupScreen from '../screens/PermissionsSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import TripsScreen from '../screens/TripsScreen';
import LiveScreen from '../screens/LiveScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import TripCreateScreen from '../screens/TripCreateScreen';
import TripOverviewScreen from '../screens/TripOverviewScreen';
import TripSetupScreen from '../screens/TripSetupScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import TripCompletionScreen from '../screens/TripCompletionScreen';
import { useAuthStore } from '../store/authStore';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  CompleteProfile: undefined;
  PermissionsSetup: undefined;
  MainTabs: {
    screen?: keyof MainTabParamList;
  } | undefined;
  CreateGroup: undefined;
  TripCreate: undefined;
  TripOverview: undefined;
  TripSetup: undefined;
  Itinerary: undefined;
  AddExpense: { groupId?: number; eventId?: string } | undefined;
  TripCompletion: undefined;
  Settings: undefined;
  Notifications: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Trips: undefined;
  Live: undefined;
  Expenses: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          height: 84,
          paddingTop: 10,
          paddingBottom: 16,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Trips: 'airplane-outline',
            Live: 'navigate-outline',
            Expenses: 'wallet-outline',
            Profile: 'person-outline',
          };

          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
        tabBarLabel: ({ color }) => (
          <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{route.name}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Trips" component={TripsScreen} />
      <Tab.Screen name="Live" component={LiveScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function BootScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export default function AppNavigator() {
  const token = useAuthStore((state) => state.token);
  const authChecked = useAuthStore((state) => state.authChecked);
  const user = useAuthStore((state) => state.user);

  if (!authChecked || (token && !user)) {
    return <BootScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token && user ? (
        !user.profile_complete ? (
          <>
            <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
            <Stack.Screen name="PermissionsSetup" component={PermissionsSetupScreen} />
          </>
        ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="PermissionsSetup" component={PermissionsSetupScreen} />
          <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
          <Stack.Screen name="TripCreate" component={TripCreateScreen} />
          <Stack.Screen name="TripOverview" component={TripOverviewScreen} />
          <Stack.Screen name="TripSetup" component={TripSetupScreen} />
          <Stack.Screen name="Itinerary" component={ItineraryScreen} />
          <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
          <Stack.Screen name="TripCompletion" component={TripCompletionScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
        )
      ) : (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
