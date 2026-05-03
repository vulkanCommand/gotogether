import React from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signOut } from '@react-native-firebase/auth';

import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { RootStackParamList } from '../navigation/AppNavigator';
import { deleteMyAccount, fetchFriends, unregisterPushToken } from '../config/api';
import { firebaseAuth } from '../config/firebase';
import { clearStoredPushToken, getStoredPushToken } from '../config/pushNotifications';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import { useTripStore } from '../store/tripStore';
import { spacing } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const clearSession = useAuthStore((state) => state.clearSession);
  const setFriends = useFriendStore((state) => state.setFriends);
  const clearFriends = useFriendStore((state) => state.clearFriends);
  const resetTrip = useTripStore((state) => state.resetTrip);

  const refreshFriends = async () => {
    try {
      const response = await fetchFriends();
      setFriends(response.friends);
      Alert.alert('Friends refreshed', `Found ${response.friends.length} connected friends.`);
    } catch (error: any) {
      Alert.alert('Refresh failed', error?.message || 'Could not refresh friends');
    }
  };

  const handleSignOut = async () => {
    const pushToken = await getStoredPushToken();
    if (pushToken) {
      try {
        await unregisterPushToken({ token: pushToken });
      } catch (error) {
        console.log('Push unregister failed', error);
      } finally {
        await clearStoredPushToken();
      }
    }
    await signOut(firebaseAuth);
    clearFriends();
    resetTrip();
    clearSession();
  };

  const handleDeleteAccount = async () => {
    Alert.alert('Delete account', 'This removes your profile and saved backend data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const pushToken = await getStoredPushToken();
            if (pushToken) {
              try {
                await unregisterPushToken({ token: pushToken });
              } catch (error) {
                console.log('Push unregister failed', error);
              } finally {
                await clearStoredPushToken();
              }
            }
            await deleteMyAccount();
            await signOut(firebaseAuth);
            clearFriends();
            resetTrip();
            clearSession();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete account');
          }
        },
      },
    ]);
  };

  return (
    <Screen showFooter>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle title="Settings" subtitle="Account actions and permission shortcuts." action={<NotificationBell />} />

        <PrimaryButton title="Grant permissions again" variant="secondary" onPress={() => navigation.navigate('PermissionsSetup')} />
        <PrimaryButton title="Refresh friends" variant="secondary" onPress={refreshFriends} />
        <PrimaryButton title="Sign out" variant="secondary" onPress={handleSignOut} />
        <PrimaryButton title="Delete account" variant="secondary" onPress={handleDeleteAccount} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
});
