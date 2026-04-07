import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import { itinerary } from '../data/mock';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function ItineraryScreen() {
  return (
    <Screen>
      <SectionTitle title="Itinerary" subtitle="Events, times, progress, and live trip flow." />

      {itinerary.map((item) => (
        <AppCard key={item.id}>
          <View style={styles.row}>
            <Text style={styles.time}>{item.time}</Text>
            <View style={styles.content}>
              <Text style={[styles.title, item.status === 'completed' && styles.completed]}>{item.title}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
          </View>
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  time: {
    width: 82,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  completed: {
    opacity: 0.55,
    textDecorationLine: 'line-through',
  },
  status: {
    marginTop: 6,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
});
