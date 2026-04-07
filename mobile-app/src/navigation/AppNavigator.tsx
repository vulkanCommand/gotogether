import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import TripsScreen from '../screens/TripsScreen';
import LiveScreen from '../screens/LiveScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import TripCreateScreen from '../screens/TripCreateScreen';
import TripOverviewScreen from '../screens/TripOverviewScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import TripCompletionScreen from '../screens/TripCompletionScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  MainTabs: undefined;
  CreateGroup: undefined;
  TripCreate: undefined;
  TripOverview: undefined;
  Itinerary: undefined;
  AddExpense: undefined;
  TripCompletion: undefined;
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

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="TripCreate" component={TripCreateScreen} />
      <Stack.Screen name="TripOverview" component={TripOverviewScreen} />
      <Stack.Screen name="Itinerary" component={ItineraryScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="TripCompletion" component={TripCompletionScreen} />
    </Stack.Navigator>
  );
}
