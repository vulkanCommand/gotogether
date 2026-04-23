import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PUSH_TOKEN_KEY = 'gotogether.pushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }

  const existingStatus = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus.status;

  if (finalStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3A86FF',
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  if (!projectId) {
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  return token;
}

export async function getStoredPushToken() {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function clearStoredPushToken() {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

export function addNotificationResponseListener(listener: (response: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}
