import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { members } from '../data/mock';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export default function CreateGroupScreen() {
  return (
    <Screen>
      <SectionTitle title="Create Group" subtitle="Search friends and build your trip circle." />

      <TextInput placeholder="Search friends" placeholderTextColor={colors.textSecondary} style={styles.input} />

      <AppCard>
        <View style={styles.wrap}>
          {members.map((member) => (
            <View key={member.id} style={styles.chip}>
              <Text style={styles.chipText}>{member.name}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      <PrimaryButton title="Create Group" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
