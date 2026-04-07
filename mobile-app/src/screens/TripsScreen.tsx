import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { trips } from '../data/mock';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export default function TripsScreen() {
  return (
    <Screen>
      <SectionTitle title="Trips" subtitle="All your planning spaces in one place." />

      {trips.map((trip) => (
        <Pressable key={trip.id}>
          <AppCard>
            <Text style={styles.title}>{trip.name}</Text>
            <Text style={styles.meta}>{trip.date}</Text>
            <View style={styles.bottom}>
              <Text style={styles.destination}>{trip.destination}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{trip.progress}</Text>
              </View>
            </View>
          </AppCard>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  bottom: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  destination: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
});
