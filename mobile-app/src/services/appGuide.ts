import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_GUIDE_SEEN_KEY = 'gotogether_app_guide_seen_v1';

export async function hasSeenAppGuide() {
  try {
    const value = await AsyncStorage.getItem(APP_GUIDE_SEEN_KEY);
    return value === 'true';
  } catch {
    return true;
  }
}

export async function markAppGuideSeen() {
  try {
    await AsyncStorage.setItem(APP_GUIDE_SEEN_KEY, 'true');
  } catch {
    // Fail safely. The guide can still close without blocking the app.
  }
}

export async function clearAppGuideSeen() {
  try {
    await AsyncStorage.removeItem(APP_GUIDE_SEEN_KEY);
  } catch {
    // Fail safely during delete-account cleanup.
  }
}
