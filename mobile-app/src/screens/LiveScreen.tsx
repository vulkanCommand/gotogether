import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export default function LiveScreen() {
  return (
    <Screen>
      <SectionTitle title="Live" subtitle="Track where everyone is and what’s next." />

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Live map will go here</Text>
      </View>

      <AppCard>
        <Text style={styles.label}>Next destination</Text>
        <Text style={styles.title}>Beach Trail</Text>
        <Text style={styles.meta}>ETA range: 9 min - 14 min</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.row}>Ravi • 3.2 miles away</Text>
        <Text style={styles.row}>Sai • 9 minutes away</Text>
        <Text style={styles.row}>Ajay • arrived</Text>
      </AppCard>

      <PrimaryButton title="Let’s Go" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapPlaceholder: {
    height: 300,
    backgroundColor: '#DCE7F9',
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapText: {
    color: colors.primary,
    fontWeight: '700',
  },
  label: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  row: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
