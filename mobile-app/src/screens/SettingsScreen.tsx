import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { deleteMyAccount, getBlockedUsers, unblockUser, unregisterPushToken } from '../config/api';
import { firebaseAuth } from '../config/firebase';
import { clearStoredPushToken, getStoredPushToken } from '../config/pushNotifications';
import { useAuthStore } from '../store/authStore';
import { Friend, useFriendStore } from '../store/friendStore';
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
  const [blockedUsersVisible, setBlockedUsersVisible] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Friend[]>([]);
  const [blockedUsersLoading, setBlockedUsersLoading] = useState(false);

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

  const loadBlockedUsers = useCallback(async () => {
    try {
      setBlockedUsersLoading(true);
      const response = await getBlockedUsers();
      setBlockedUsers(response.users ?? []);
    } catch (error) {
      console.log('Blocked users load failed', error);
      Alert.alert('Blocked users unavailable', 'Could not load blocked users right now.');
    } finally {
      setBlockedUsersLoading(false);
    }
  }, []);

  const openBlockedUsers = () => {
    setBlockedUsersVisible(true);
    void loadBlockedUsers();
  };

  const handleUnblockUser = (blockedUser: Friend) => {
    Alert.alert('Unblock user?', `Allow ${blockedUser.name || blockedUser.email || 'this user'} to appear again in discovery and invite suggestions?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await unblockUser(blockedUser.id);
            setBlockedUsers((current) => current.filter((item) => item.id !== blockedUser.id));
            Alert.alert('User unblocked', `${blockedUser.name || blockedUser.email || 'This user'} can appear again in discovery.`);
          } catch {
            Alert.alert('Unblock failed', 'Could not unblock this user. Please try again.');
          }
        },
      },
    ]);
  };

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
      'Deleting your account will remove or anonymize your profile and sign-in information. Some shared trip, itinerary, and expense records may remain visible to other trip members where needed for group history and expense records.',
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

          <SettingsRow
            icon="ban-outline"
            title="Blocked Users"
            subtitle="Manage who is hidden from discovery and new trip invites."
            onPress={openBlockedUsers}
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
            onPress={() => void Linking.openURL('https://www.durgakalyan.com/gotogether-privacy')}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="Read the app terms and usage guidelines."
            onPress={() => void Linking.openURL('https://www.durgakalyan.com/gotogether-terms')}
          />
          <SettingsRow
            icon="help-circle-outline"
            title="Support"
            subtitle="Get help, report bugs, or ask account questions."
            onPress={() => void Linking.openURL('https://www.durgakalyan.com/gotogether-support')}
          />
          <SettingsRow
            icon="trash-bin-outline"
            title="Account Deletion Help"
            subtitle="Learn what happens when you delete your account."
            onPress={() => void Linking.openURL('https://www.durgakalyan.com/gotogether-delete-account')}
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
              <Text style={styles.rowSubtitle}>
                Remove or anonymize your sign-in details while some shared trip history may remain for other members.
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      <Modal transparent visible={blockedUsersVisible} animationType="fade" onRequestClose={() => setBlockedUsersVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBlockedUsersVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Blocked Users</Text>
              <Pressable style={styles.modalCloseButton} onPress={() => setBlockedUsersVisible(false)}>
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            {blockedUsersLoading ? (
              <View style={styles.modalLoadingState}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : blockedUsers.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.blockedList}>
                {blockedUsers.map((blockedUser) => (
                  <View key={blockedUser.id} style={styles.blockedRow}>
                    <View style={styles.blockedAvatar}>
                      <Text style={styles.blockedAvatarText}>
                        {(blockedUser.name || blockedUser.email || 'U').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.blockedCopy}>
                      <Text style={styles.blockedName}>{blockedUser.name || blockedUser.email || 'Blocked user'}</Text>
                      <Text style={styles.blockedMeta}>{blockedUser.phone || blockedUser.email || 'Hidden from discovery'}</Text>
                    </View>

                    <Pressable style={styles.unblockButton} onPress={() => handleUnblockUser(blockedUser)}>
                      <Text style={styles.unblockButtonText}>Unblock</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.modalEmptyState}>
                <Text style={styles.modalEmptyTitle}>No blocked users.</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxHeight: '78%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalLoadingState: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedList: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: 14,
  },
  blockedAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedAvatarText: {
    color: colors.accentStrong,
    fontSize: 14,
    fontWeight: '700',
  },
  blockedCopy: {
    flex: 1,
  },
  blockedName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  blockedMeta: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
  },
  unblockButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  unblockButtonText: {
    color: colors.accentStrong,
    fontSize: 13,
    fontWeight: '600',
  },
  modalEmptyState: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  modalEmptyTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
