import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { members } from '../data/mock';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export default function CreateGroupScreen({ navigation }: Props) {
  const crew = useTripStore((state) => state.crew);
  const setCrew = useTripStore((state) => state.setCrew);

  const [query, setQuery] = useState('');

  const selectedIds = useMemo(() => crew.map((member) => member.id), [crew]);

  const filteredMembers = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return members;
    }

    return members.filter((member) => member.name.toLowerCase().includes(value));
  }, [query]);

  const toggleMember = (id: string) => {
    const isSelected = selectedIds.includes(id);

    if (isSelected) {
      setCrew(crew.filter((member) => member.id !== id));
      return;
    }

    const memberToAdd = members.find((member) => member.id === id);

    if (!memberToAdd) {
      return;
    }

    setCrew([
      ...crew,
      {
        id: memberToAdd.id,
        name: memberToAdd.name,
      },
    ]);
  };

  const selectedMembers =
    crew.length > 0
      ? crew
      : members.filter((member) => ['1', '2', '3'].includes(member.id));

  const handleContinue = () => {
    if (crew.length === 0) {
      const fallbackCrew = members
        .filter((member) => ['1', '2', '3'].includes(member.id))
        .map((member) => ({
          id: member.id,
          name: member.name,
        }));

      setCrew(fallbackCrew);
    }

    navigation.navigate('TripCreate');
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Create Group"
          subtitle="Pick your crew first, then move into dates, location voting, and trip planning."
        />

        <AppCard>
          <Text style={styles.eyebrow}>Search friends</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Type a name"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          <View style={styles.resultsWrap}>
            {filteredMembers.map((member) => {
              const selected = selectedIds.includes(member.id);

              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleMember(member.id)}
                  style={[styles.memberChip, selected && styles.memberChipSelected]}
                >
                  <View style={[styles.avatar, selected && styles.avatarSelected]}>
                    <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                      {member.name.charAt(0)}
                    </Text>
                  </View>

                  <Text style={[styles.memberChipText, selected && styles.memberChipTextSelected]}>
                    {member.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.eyebrow}>Selected crew</Text>
              <Text style={styles.summaryTitle}>{selectedMembers.length} people ready</Text>
            </View>

            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>Step 1 of 2</Text>
            </View>
          </View>

          <View style={styles.selectedWrap}>
            {selectedMembers.length > 0 ? (
              selectedMembers.map((member) => (
                <View key={member.id} style={styles.selectedCard}>
                  <View style={styles.selectedAvatar}>
                    <Text style={styles.selectedAvatarText}>{member.name.charAt(0)}</Text>
                  </View>
                  <Text style={styles.selectedName}>{member.name}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No one selected yet</Text>
                <Text style={styles.emptyMeta}>
                  Pick at least one friend to start the trip planning flow.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>What happens next</Text>
            <Text style={styles.noteText}>
              After this screen you’ll match dates, vote on destination, and choose a trip lead.
            </Text>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.muted,
  },

  memberChipSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D8E6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarSelected: {
    backgroundColor: colors.accent,
  },

  avatarText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },

  avatarTextSelected: {
    color: '#FFFFFF',
  },

  memberChipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  memberChipTextSelected: {
    color: colors.accent,
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

  emptyState: {
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

  noteCard: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#F8FAFC',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  noteTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },

  noteText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});