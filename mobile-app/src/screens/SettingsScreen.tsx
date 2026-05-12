import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signOut } from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import NotificationBell from '../components/NotificationBell';
import Screen from '../components/Screen';
import { RootStackParamList } from '../navigation/AppNavigator';
import { deleteMyAccount, unregisterPushToken } from '../config/api';
import { firebaseAuth } from '../config/firebase';
import { clearStoredPushToken, getStoredPushToken } from '../config/pushNotifications';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { clearAppGuideSeen } from '../services/appGuide';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const clearFriends = useFriendStore((state) => state.clearFriends);
  const resetTrip = useTripStore((state) => state.resetTrip);
  const [permissionSummary, setPermissionSummary] = useState({
    contacts: 'Unknown',
    location: 'Unknown',
    photos: 'Unknown',
    notifications: 'Unknown',
  });

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const [contacts, location, photos, notifications] = await Promise.all([
        Contacts.getPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
        Notifications.getPermissionsAsync(),
      ]);

      setPermissionSummary({
        contacts: formatPermissionStatus(contacts.status),
        location: formatPermissionStatus(location.status),
        photos: formatPermissionStatus(photos.status),
        notifications: formatPermissionStatus(notifications.status),
      });
    } catch (error) {
      console.log('Permission status load failed', error);
    }
  }, []);

  React.useEffect(() => {
    void refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Sign out from this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
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
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete account',
      'This will permanently remove your profile and saved backend data. This action cannot be undone.',
      [
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
              await clearAppGuideSeen();
              clearFriends();
              resetTrip();
              clearSession();
            } catch (error: any) {
              Alert.alert('Delete failed', error?.message || 'Could not delete account');
            }
          },
        },
      ]
    );
  };

  return (
    <Screen showFooter showBackButton>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Manage your account and app access.</Text>
          </View>

          <NotificationBell />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</Text>
          </View>

          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{user?.name || 'Traveler'}</Text>
            <Text style={styles.profilePhone}>{user?.phone || user?.email || 'Signed in user'}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>

          <SettingsRow
            icon="person-circle-outline"
            title="Profile details"
            subtitle="Update your name, phone number, and profile photo."
            onPress={() => navigation.goBack()}
          />

          <SettingsRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Trip updates, itinerary changes, and activity alerts."
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Permissions</Text>

          <SettingsRow
            icon="people-outline"
            title="Contacts"
            subtitle={`Status: ${permissionSummary.contacts}`}
            onPress={() => void Linking.openSettings()}
          />
          <SettingsRow
            icon="location-outline"
            title="Location"
            subtitle={`Status: ${permissionSummary.location}`}
            onPress={() => void Linking.openSettings()}
          />
          <SettingsRow
            icon="image-outline"
            title="Photos"
            subtitle={`Status: ${permissionSummary.photos}`}
            onPress={() => void Linking.openSettings()}
          />
          <SettingsRow
            icon="notifications-circle-outline"
            title="Push notifications"
            subtitle={`Status: ${permissionSummary.notifications}`}
            onPress={() => void Linking.openSettings()}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Support and legal</Text>

          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            subtitle="See how GoTogether handles your data."
            onPress={() => void Linking.openURL('https://gotogether.app/privacy')}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="Read the app terms and usage guidelines."
            onPress={() => void Linking.openURL('https://gotogether.app/terms')}
          />
          <SettingsRow
            icon="help-circle-outline"
            title="Support"
            subtitle="Get help, report bugs, or ask account questions."
            onPress={() => void Linking.openURL('mailto:support@gotogether.app')}
          />
          <SettingsRow
            icon="phone-portrait-outline"
            title="App version"
            subtitle={`Version ${appVersion}`}
            onPress={() => undefined}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Session</Text>

          <SettingsRow
            icon="log-out-outline"
            title="Sign out"
            subtitle="Leave this device signed out of GoTogether."
            onPress={handleSignOut}
          />

          <Pressable style={styles.dangerRow} onPress={handleDeleteAccount}>
            <View style={styles.dangerIcon}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </View>

            <View style={styles.rowCopy}>
              <Text style={styles.dangerTitle}>Delete account</Text>
              <Text style={styles.rowSubtitle}>Permanently remove your profile and backend data.</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatPermissionStatus(status?: string) {
  switch (status) {
    case 'granted':
      return 'Granted';
    case 'denied':
      return 'Denied';
    case 'undetermined':
      return 'Not requested';
    default:
      return 'Unknown';
  }
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.accentStrong} />
      </View>

      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  profileCard: {
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: colors.shadowStrong,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  profileAvatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: colors.accentStrong,
    fontSize: 24,
    fontWeight: '700',
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  profilePhone: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  dangerIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
