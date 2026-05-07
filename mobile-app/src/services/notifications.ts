import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

import { fetchTripDetails, registerPushToken } from '../config/api';
import { getStoredPushToken, registerForPushNotificationsAsync } from '../config/pushNotifications';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { mapApiMembersToCrew } from '../utils/tripFlow';

const PUSH_REGISTRATION_KEY = 'gotogether.pushRegistration';

type StoredRegistration = {
  userId: number;
  token: string;
};

function registrationKey(userId: number, token: string) {
  return `${userId}:${token}`;
}

async function readStoredRegistration() {
  const raw = await AsyncStorage.getItem(PUSH_REGISTRATION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredRegistration;
  } catch {
    return null;
  }
}

async function writeStoredRegistration(value: StoredRegistration) {
  await AsyncStorage.setItem(PUSH_REGISTRATION_KEY, JSON.stringify(value));
}

export async function ensurePushRegistration(userId: number) {
  if (!Device.isDevice) {
    return null;
  }

  const token = (await registerForPushNotificationsAsync()) || (await getStoredPushToken());
  if (!token) {
    return null;
  }

  const saved = await readStoredRegistration();
  if (saved && registrationKey(saved.userId, saved.token) === registrationKey(userId, token)) {
    return token;
  }

  await registerPushToken({
    expo_push_token: token,
    platform: Device.osName?.toLowerCase() || 'expo',
    device_id: Device.osInternalBuildId || Device.modelId || undefined,
  });

  await writeStoredRegistration({ userId, token });
  return token;
}

async function openTripFromNotification(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  tripId: number
) {
  try {
    const details = await fetchTripDetails(tripId);
    const crew = mapApiMembersToCrew(details.members);
    const store = useTripStore.getState();

    store.setCurrentTrip(details.trip);
    store.setCrew(crew);
    store.setTripLead(crew.find((member) => member.role === 'lead') ?? crew[0] ?? null);

    if (navigationRef.isReady()) {
      navigationRef.navigate(details.trip.completed_at ? 'TripCompletion' : 'TripOverview');
    }
  } catch (error) {
    console.log('Notification navigation failed', error);
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs', {
        screen: 'Trips',
        params: { initialSection: 'Current' },
      });
    }
  }
}

export function attachNotificationNavigation(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>
) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    const type = String(data.type || data.kind || '').trim();
    const tripId = Number(data.tripId ?? data.tripID ?? data.trip_id ?? 0);

    if (type === 'trip_added' && Number.isFinite(tripId) && tripId > 0) {
      void openTripFromNotification(navigationRef, tripId);
      return;
    }

    if (navigationRef.isReady()) {
      navigationRef.navigate('Notifications');
    }
  });
}
