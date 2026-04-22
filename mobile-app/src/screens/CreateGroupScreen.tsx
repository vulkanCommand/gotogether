import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useFriendStore } from '../store/friendStore';
import { useAuthStore } from '../store/authStore';
import { syncDeviceContacts } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export default function CreateGroupScreen({ navigation }: Props) {
  const setCrew = useTripStore((state) => state.setCrew);
  const friends = useFriendStore((state) => state.friends);
  const setFriends = useFriendStore((state) => state.setFriends);
  const user = useAuthStore((state) => state.user);

  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const filteredFriends = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return friends;
    }

    return friends.filter((friend) => {
      const haystack = `${friend.name} ${friend.email} ${friend.username}`.toLowerCase();
      return haystack.includes(value);
    });
  }, [friends, query]);

  const selectedFriends = useMemo(
    () => friends.filter((friend) => selectedIds.includes(friend.id)),
    [friends, selectedIds]
  );

  const toggleFriend = (friendId: number) => {
    setSelectedIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId]
    );
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

  const connectByEmail = async () => {
    const email = query.trim().toLowerCase();
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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Create Group"
          subtitle="Start with your contacts who already use the app, then move into trip planning."
        />

        <AppCard>
          <Text style={styles.eyebrow}>Connected friends</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or email"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No contacts matched yet</Text>
              <Text style={styles.emptyMeta}>
                You can still continue solo, or grant contacts access from Profile to discover friends.
              </Text>
              {query.trim().includes('@') ? (
                <Pressable style={styles.emailSearchButton} onPress={connectByEmail}>
                  <Text style={styles.emailSearchButtonText}>Connect {query.trim()} by email</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.resultsWrap}>
              {filteredFriends.map((friend) => {
                const selected = selectedIds.includes(friend.id);

                return (
                  <Pressable
                    key={friend.id}
                    onPress={() => toggleFriend(friend.id)}
                    style={[styles.memberChip, selected && styles.memberChipSelected]}
                  >
                    <View style={[styles.avatar, selected && styles.avatarSelected]}>
                      <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                        {(friend.name || friend.email).charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.friendMeta}>
                      <Text
                        style={[
                          styles.memberChipText,
                          selected && styles.memberChipTextSelected,
                        ]}
                      >
                        {friend.name || friend.email}
                      </Text>
                      <Text style={styles.memberChipSubtext}>
                        {friend.email || friend.username}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </AppCard>

        <AppCard>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.eyebrow}>Selected crew</Text>
              <Text style={styles.summaryTitle}>{selectedFriends.length + 1} people ready</Text>
            </View>

            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>Real users</Text>
            </View>
          </View>

          <View style={styles.selectedWrap}>
            {user ? (
              <View style={styles.selectedCard}>
                <View style={styles.selectedAvatar}>
                  <Text style={styles.selectedAvatarText}>
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.selectedName}>{user.name || user.email}</Text>
                  <Text style={styles.selectedRole}>You</Text>
                </View>
              </View>
            ) : null}

            {selectedFriends.map((friend) => (
              <View key={friend.id} style={styles.selectedCard}>
                <View style={styles.selectedAvatar}>
                  <Text style={styles.selectedAvatarText}>
                    {(friend.name || friend.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.selectedName}>{friend.name || friend.email}</Text>
                  <Text style={styles.selectedRole}>{friend.email}</Text>
                </View>
              </View>
            ))}
          </View>
        </AppCard>

        <PrimaryButton title="Continue to Trip Planning" onPress={handleContinue} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  resultsWrap: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberChipSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D8E6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    backgroundColor: colors.accent,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  avatarTextSelected: {
    color: '#FFFFFF',
  },
  friendMeta: {
    flex: 1,
  },
  memberChipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  memberChipTextSelected: {
    color: colors.accent,
  },
  memberChipSubtext: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summaryPill: {
    backgroundColor: '#EEF4FF',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryPillText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedWrap: {
    gap: spacing.sm,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  selectedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  selectedName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  selectedRole: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  emailSearchButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emailSearchButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
