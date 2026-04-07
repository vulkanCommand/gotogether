import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export default function TripCreateScreen() {
  return (
    <Screen>
      <SectionTitle title="Create Trip" subtitle="Choose dates, vote destinations, and assign a lead." />

      <AppCard>
        <Text style={styles.step}>Step 1</Text>
        <Text style={styles.title}>Availability Calendar</Text>
        <Text style={styles.meta}>Blue means available. Gray means unavailable.</Text>
        <View style={styles.calendarMock} />
      </AppCard>

      <AppCard>
        <Text style={styles.step}>Step 2</Text>
        <Text style={styles.title}>Destination Voting</Text>
        <Text style={styles.meta}>Cards, photos, and one-tap voting go here.</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.step}>Step 3</Text>
        <Text style={styles.title}>Trip Lead</Text>
        <Text style={styles.meta}>Vote for one member to coordinate the trip.</Text>
      </AppCard>

      <PrimaryButton title="Continue to Overview" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  title: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  calendarMock: {
    marginTop: spacing.md,
    height: 180,
    borderRadius: radius.md,
    backgroundColor: '#E7F0FF',
  },
});
