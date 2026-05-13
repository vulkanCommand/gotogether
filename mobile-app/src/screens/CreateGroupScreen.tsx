import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { Friend, useFriendStore } from '../store/friendStore';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { blockUser, fetchFriends, getBlockedUsers, syncDeviceContacts } from '../config/api';
import { collectDeviceContactLookupPayload, DeviceInviteContact } from '../utils/contacts';
import { formatPhoneForDisplay, formatPhoneForFirebase } from '../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export default function CreateGroupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setCrew = useTripStore((state) => state.setCrew);
  const friends = useFriendStore((state) => state.friends);
  const setFriends = useFriendStore((state) => state.setFriends);
  const user = useAuthStore((state) => state.user);

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inviting, setInviting] = useState(false);
  const [syncingFriends, setSyncingFriends] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<DeviceInviteContact[]>([]);
  const [restrictedUsers, setRestrictedUsers] = useState<Friend[]>([]);

  const refreshFriends = useCallback(async () => {
    try {
      setSyncingFriends(true);
      const [response, blockedResponse] = await Promise.all([fetchFriends(), getBlockedUsers()]);
      setFriends(response.friends);
      setRestrictedUsers(blockedResponse.restricted_users ?? blockedResponse.users ?? []);
    } catch (error) {
      console.log('Friend refresh failed', error);
    } finally {
      setSyncingFriends(false);
    }
  }, [setFriends]);

  const syncContactsFromDevice = useCallback(async () => {
    try {
      setSyncingFriends(true);
      const contacts = await collectDeviceContactLookupPayload();
      setDeviceContacts(contacts.contacts);
      if (!contacts.granted) {
        Alert.alert(
          'Contacts permission not granted',
          'You can still invite manually with a phone number, or enable Contacts in Settings when you want to sync friends.'
        );
        return;
      }

      await syncDeviceContacts({
        emails: contacts.emails,
        phones: contacts.phones,
      });
      const [response, blockedResponse] = await Promise.all([fetchFriends(), getBlockedUsers()]);
      setFriends(response.friends);
      setRestrictedUsers(blockedResponse.restricted_users ?? blockedResponse.users ?? []);
    } catch (error) {
      console.log('Device contact sync failed', error);
    } finally {
      setSyncingFriends(false);
    }
  }, [setFriends]);

  useFocusEffect(
    useCallback(() => {
      void refreshFriends();
    }, [refreshFriends])
  );

  const filteredFriends = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) {
      return friends;
    }

    return friends.filter((friend) =>
      `${friend.name} ${friend.email} ${friend.username} ${friend.phone}`.toLowerCase().includes(value)
    );
  }, [friends, search]);

  const selectedFriends = useMemo(
    () => friends.filter((friend) => selectedIds.includes(friend.id)),
    [friends, selectedIds]
  );

  const inviteCandidates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const friendEmailSet = new Set(friends.map((friend) => friend.email?.trim().toLowerCase()).filter(Boolean));
    const friendPhoneSet = new Set(friends.map((friend) => formatPhoneForFirebase(friend.phone)).filter(Boolean));
    const restrictedEmailSet = new Set(
      restrictedUsers.map((restrictedUser) => restrictedUser.email?.trim().toLowerCase()).filter(Boolean)
    );
    const restrictedPhoneSet = new Set(
      restrictedUsers.map((restrictedUser) => formatPhoneForFirebase(restrictedUser.phone)).filter(Boolean)
    );

    return deviceContacts
      .filter((contact) => {
        const matchesRestrictedUser =
          contact.emails.some((email) => restrictedEmailSet.has(email)) ||
          contact.phones.some((phone) => restrictedPhoneSet.has(phone));
        if (matchesRestrictedUser) {
          return false;
        }
        const hasUnsyncedChannel =
          contact.emails.some((email) => !friendEmailSet.has(email)) ||
          contact.phones.some((phone) => !friendPhoneSet.has(phone));
        if (!hasUnsyncedChannel) {
          return false;
        }
        if (!normalizedSearch) {
          return false;
        }

        return `${contact.name} ${contact.emails.join(' ')} ${contact.phones.join(' ')}`
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .map((contact) => ({
        ...contact,
        invitePhone: contact.phones.find((phone) => !friendPhoneSet.has(phone)) || '',
      }))
      .filter((contact) => Boolean(contact.invitePhone));
  }, [deviceContacts, friends, restrictedUsers, search]);

  const toggle = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const confirmBlockUser = (friendId: number, friendName: string) => {
    Alert.alert(
      'Block this user?',
      'You won’t see each other in contact search or invite suggestions. Existing shared trip history will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(friendId);
              setFriends(friends.filter((friend) => friend.id !== friendId));
              setRestrictedUsers((current) => {
                if (current.some((item) => item.id === friendId)) {
                  return current;
                }
                const blockedFriend = friends.find((friend) => friend.id === friendId);
                return blockedFriend ? [...current, blockedFriend] : current;
              });
              setSelectedIds((current) => current.filter((id) => id !== friendId));
              Alert.alert('User blocked', `${friendName} has been blocked.`);
            } catch {
              Alert.alert('Block failed', 'Could not block this user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const connectByEmail = async () => {
    const email = search.trim().toLowerCase();
    if (!email.includes('@')) {
      return;
    }
    try {
      await syncDeviceContacts({ emails: [email], phones: [] });
      const response = await fetchFriends();
      setFriends(response.friends);
    } catch (error) {
      console.log('Manual friend connect failed', error);
    }
  };

  const normalizedInvitePhone = useMemo(() => formatPhoneForFirebase(search), [search]);
  const canInviteBySMS = normalizedInvitePhone.length > 0;

  const inviteBySMS = async () => {
    if (!canInviteBySMS) {
      return;
    }

    try {
      setInviting(true);
      // Use the device SMS composer directly.  On some deployments the
      // backend provider for SMS is not configured, so attempting to send
      // invites via the API fails.  Using a deep link into the default
      // messenger app bypasses that requirement and provides a better UX.
      const smsUrl = `sms:${normalizedInvitePhone}`;
      await Linking.openURL(smsUrl);
      Alert.alert('Invite', `Use your messaging app to send an invite to ${formatPhoneForDisplay(normalizedInvitePhone)}.`);
    } catch (error: any) {
      Alert.alert('Invite failed', error?.message || 'Could not open the SMS composer right now.');
    } finally {
      setInviting(false);
    }
  };

  const handleContinue = () => {
    const currentUserCrew = user
      ? [
          {
            id: String(user.id),
            name: user.name || user.email,
            role: 'Trip lead',
          },
        ]
      : [];

    const selectedCrew = selectedFriends.map((friend) => ({
      id: String(friend.id),
      name: friend.name || friend.email,
      role: 'Crew member',
    }));

    setCrew([...currentUserCrew, ...selectedCrew]);
    navigation.navigate('TripCreate');
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Create Group</Text>
        </View>

        {selectedFriends.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedRow}>
            {selectedFriends.map((friend) => (
              <View key={friend.id} style={styles.selectedChip}>
                <View style={styles.selectedAvatarWrap}>
                  <View style={styles.selectedAvatar}>
                    <Text style={styles.selectedAvatarText}>
                      {(friend.name || friend.email).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Pressable style={styles.removeButton} onPress={() => toggle(friend.id)}>
                    <Ionicons name="close" size={10} color="#FFFFFF" />
                  </Pressable>
                </View>
                <Text numberOfLines={1} style={styles.selectedName}>
                  {(friend.name || friend.email).split(' ')[0]}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.searchCard}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search friends..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {/* small refresh button to re-sync contacts and friends */}
          <Pressable onPress={() => void syncContactsFromDevice()} style={styles.refreshButton} hitSlop={8}>
            <Ionicons name="people-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {syncingFriends ? <Text style={styles.syncingText}>Checking contacts and refreshing friends...</Text> : null}

        <View style={styles.list}>
          {filteredFriends.map((friend) => {
            const isSelected = selectedIds.includes(friend.id);

            return (
              <Pressable
                key={friend.id}
                onPress={() => toggle(friend.id)}
                onLongPress={() => confirmBlockUser(friend.id, friend.name || friend.email || 'This user')}
                style={[styles.friendRow, isSelected && styles.friendRowSelected]}
              >
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarText}>
                    {(friend.name || friend.email).charAt(0).toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.friendName}>{friend.name || friend.email}</Text>

                <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                  {isSelected ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                </View>
              </Pressable>
            );
          })}

          {inviteCandidates.length > 0 ? (
            <View style={styles.inviteSection}>
              <Text style={styles.inviteSectionTitle}>Invite contacts to the app</Text>
              {inviteCandidates.map((contact) => (
                <View key={contact.id} style={styles.inviteRow}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {contact.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.inviteCopy}>
                    <Text style={styles.friendName}>{contact.name}</Text>
                    <Text style={styles.inviteMeta}>{formatPhoneForDisplay(contact.invitePhone)}</Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      try {
                        setInviting(true);
                        // Open SMS composer for the selected contact instead of calling the backend.  This
                        // avoids the “sms provider is not configured” error.
                        const smsUrl = `sms:${contact.invitePhone}`;
                        await Linking.openURL(smsUrl);
                        Alert.alert('Invite', `Use your messaging app to send an invite to ${formatPhoneForDisplay(contact.invitePhone)}.`);
                      } catch (error: any) {
                        Alert.alert('Invite failed', error?.message || 'Could not open the SMS composer right now.');
                      } finally {
                        setInviting(false);
                      }
                    }}
                    style={styles.inlineInviteButton}
                  >
                    <Text style={styles.inlineInviteButtonText}>{inviting ? 'Sending...' : 'Invite'}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {filteredFriends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No friends found</Text>
              <Text style={styles.emptyCopy}>
                Search for a connected friend, or invite one of your contacts if they have not joined yet.
              </Text>
              {search.trim().includes('@') ? (
                <Pressable onPress={connectByEmail} style={styles.connectButton}>
                  <Text style={styles.connectButtonText}>Connect {search.trim()}</Text>
                </Pressable>
              ) : null}
              {canInviteBySMS ? (
                <Pressable onPress={inviteBySMS} style={styles.connectButton}>
                  <Text style={styles.connectButtonText}>
                    {inviting ? 'Sending SMS...' : `Invite ${formatPhoneForDisplay(normalizedInvitePhone)}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {selectedIds.length > 0 ? (
        <View style={[styles.footer, { bottom: Math.max(insets.bottom, 12) }]}>
          <Pressable onPress={handleContinue} style={styles.ctaButton}>
            <Text style={styles.ctaText}>Create Group ({selectedIds.length + 1} members)</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 132,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  selectedRow: {
    gap: 12,
    paddingBottom: spacing.md,
  },
  selectedChip: {
    width: 62,
    alignItems: 'center',
    gap: 4,
  },
  selectedAvatarWrap: {
    position: 'relative',
  },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCEAFF',
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarText: {
    color: colors.accentStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedName: {
    maxWidth: 56,
    fontSize: 10,
    color: colors.textSecondary,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  refreshButton: {
    marginLeft: 4,
  },
  list: {
    gap: 8,
  },
  inviteSection: {
    gap: 8,
    marginTop: spacing.sm,
  },
  inviteSectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  syncingText: {
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontSize: 12,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendRowSelected: {
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderColor: 'rgba(37,99,235,0.24)',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E7F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: colors.accentStrong,
    fontWeight: '600',
    fontSize: 14,
  },
  friendName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteCopy: {
    flex: 1,
  },
  inviteMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  inlineInviteButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineInviteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCopy: {
    marginTop: 6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  connectButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  ctaButton: {
    borderRadius: 20,
    backgroundColor: colors.accent,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
