import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { trips } from '../data/mock';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
  const activeTrip = trips[0];

  return (
    <Screen>
      <SectionTitle
        title="Good evening, Kalyan"
        subtitle="Your crew is almost ready for the next trip."
      />

      <AppCard>
        <Text style={styles.label}>Active trip</Text>
        <Text style={styles.tripTitle}>{activeTrip.name}</Text>
        <Text style={styles.meta}>
          {activeTrip.date} • {activeTrip.destination}
        </Text>

        <View style={styles.pills}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{activeTrip.members} members</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{activeTrip.progress}</Text>
          </View>
        </View>

        <View style={styles.primaryActions}>
          <PrimaryButton
            title="Open Trip Overview"
            onPress={() => navigation.navigate('TripOverview')}
          />
          <PrimaryButton
            title="Open Itinerary"
            variant="secondary"
            onPress={() => navigation.navigate('Itinerary')}
          />
        </View>
      </AppCard>

      <View style={styles.quickGrid}>
        <Pressable
          style={styles.quickCard}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <Text style={styles.quickEyebrow}>New flow</Text>
          <Text style={styles.quickTitle}>Create group</Text>
          <Text style={styles.quickMeta}>Start a new planning space</Text>
        </Pressable>

        <Pressable
          style={styles.quickCard}
          onPress={() => navigation.navigate('TripCreate')}
        >
          <Text style={styles.quickEyebrow}>Planning</Text>
          <Text style={styles.quickTitle}>Create trip</Text>
          <Text style={styles.quickMeta}>Dates, destination, and lead</Text>
        </Pressable>

        <Pressable
          style={styles.quickCard}
          onPress={() => navigation.navigate('AddExpense')}
        >
          <Text style={styles.quickEyebrow}>Finance</Text>
          <Text style={styles.quickTitle}>Add expense</Text>
          <Text style={styles.quickMeta}>Drop a shared trip cost fast</Text>
        </Pressable>

        <Pressable
          style={styles.quickCard}
          onPress={() => navigation.navigate('TripCompletion')}
        >
          <Text style={styles.quickEyebrow}>Wrap-up</Text>
          <Text style={styles.quickTitle}>Complete trip</Text>
          <Text style={styles.quickMeta}>Finalize the flow preview</Text>
        </Pressable>
      </View>

      <AppCard>
        <Text style={styles.sectionHeader}>What’s next</Text>
        <Text style={styles.rowTitle}>Cabin check-in and reset</Text>
        <Text style={styles.rowMeta}>Today • 4:30 PM</Text>
        <Text style={styles.rowSubMeta}>
          Open Itinerary from this page any time while testing on iOS.
        </Text>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  tripTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pill: {
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  primaryActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  quickGrid: {
    gap: spacing.md,
  },
  quickCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 6,
  },
  quickTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  quickMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowMeta: {
    marginTop: 4,
    color: colors.textSecondary,
  },
  rowSubMeta: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});