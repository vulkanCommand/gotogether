import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export default function TripOverviewScreen() {
  return (
    <Screen>
      <SectionTitle title="Trip Overview" subtitle="Everything your crew needs in one place." />

      <View style={styles.hero} />

      <AppCard>
        <Text style={styles.trip}>Smoky Mountains Escape</Text>
        <Text style={styles.meta}>May 24 - May 27 • Gatlinburg</Text>

        <View style={styles.progressWrap}>
          <Text style={styles.progress}>✓ Dates locked</Text>
          <Text style={styles.progress}>✓ Destination selected</Text>
          <Text style={styles.progress}>✓ Lead assigned</Text>
          <Text style={styles.progress}>• Itinerary in progress</Text>
        </View>
      </AppCard>

      <PrimaryButton title="View Itinerary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: '#DCE7F9',
  },
  trip: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  progressWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  progress: {
    fontSize: 14,
    color: colors.textPrimary,
  },
});
