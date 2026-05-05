import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import AppFooter from '../components/AppFooter';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { useFriendStore } from '../store/friendStore';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { sendSMSInvite, syncDeviceContacts } from '../config/api';
import { formatPhoneForDisplay, formatPhoneForFirebase } from '../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export default function CreateGroupScreen({ navigation }: Props) {
  const setCrew = useTripStore((state) => state.setCrew);
  const friends = useFriendStore((state) => state.friends);
  const setFriends = useFriendStore((state) => state.setFriends);
  const user = useAuthStore((state) => state.user);

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inviting, setInviting] = useState(false);

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

  const toggle = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const connectByEmail = async () => {
    const email = search.trim().toLowerCase();
    if (!email.includes('@')) {
      return;
    }
    try {
      const response = await syncDeviceContacts({ emails: [email], phones: [] });
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
      await sendSMSInvite({
        phone: normalizedInvitePhone,
        name: search.trim(),
      });
      Alert.alert('Invite sent', `We sent an SMS invite to ${formatPhoneForDisplay(normalizedInvitePhone)}.`);
    } catch (error: any) {
      Alert.alert('Invite failed', error?.message || 'Could not send the SMS invite right now.');
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
        </View>

        <View style={styles.list}>
          {filteredFriends.map((friend) => {
            const isSelected = selectedIds.includes(friend.id);

            return (
              <Pressable
                key={friend.id}
                onPress={() => toggle(friend.id)}
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

          {filteredFriends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No friends found</Text>
              <Text style={styles.emptyCopy}>
                Search for a connected friend, or continue with just your own trip crew for now.
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
        <View style={styles.footer}>
          <Pressable onPress={handleContinue} style={styles.ctaButton}>
            <Text style={styles.ctaText}>Create Group ({selectedIds.length + 1} members)</Text>
          </Pressable>
        </View>
      ) : null}
      <AppFooter />
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
    paddingBottom: 220,
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
    fontWeight: '800',
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
    fontWeight: '900',
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
  list: {
    gap: 8,
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
    fontWeight: '800',
    fontSize: 14,
  },
  friendName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
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
    bottom: 84,
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
    fontWeight: '800',
  },
});
