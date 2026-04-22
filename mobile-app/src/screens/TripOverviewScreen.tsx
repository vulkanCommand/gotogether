import React, { useCallback, useEffect, useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useTripStore } from '../store/tripStore';
import { fetchTripDetails } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'TripOverview'>;

const heroImage = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470';

export default function TripOverviewScreen({ navigation }: Props) {
  const {
    currentTrip,
    crew,
    bestMatchRange,
    destinationOptions,
    selectedDestinationId,
    tripLead,
    itineraryDays,
    setCrew,
    setCurrentTrip,
  } = useTripStore();

  const hydrateTrip = useCallback(async () => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      const response = await fetchTripDetails(currentTrip.id);
      setCurrentTrip(response.trip);
      setCrew(
        response.members.map((member) => ({
          id: String(member.id),
          name: member.name,
          role: member.role,
        }))
      );
    } catch (error) {
      console.log('Fetch trip details failed', error);
    }
  }, [currentTrip?.id, setCrew, setCurrentTrip]);

  useEffect(() => {
    hydrateTrip();
  }, [hydrateTrip]);

  const selectedDestination = useMemo(
    () => destinationOptions.find((item) => item.id === selectedDestinationId) ?? null,
    [destinationOptions, selectedDestinationId]
  );

  const totalPlans = itineraryDays.reduce((sum, day) => sum + day.events.length, 0);

  const tripName = currentTrip?.name ?? selectedDestination?.name ?? 'Your Trip';
  const tripDates = currentTrip ? `${currentTrip.start_date} - ${currentTrip.end_date}` : bestMatchRange || 'Dates pending';
  const tripDestination =
    currentTrip?.destination ??
    (selectedDestination
      ? selectedDestination.country
        ? `${selectedDestination.name}, ${selectedDestination.country}`
        : selectedDestination.name
      : 'Destination pending');

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionTitle title="Trip Overview" subtitle="Everything your crew needs in one place." />

        <Image source={{ uri: heroImage }} style={styles.hero} />

        <AppCard>
          <Text style={styles.trip}>{tripName}</Text>
          <Text style={styles.meta}>{tripDates}</Text>
          <Text style={styles.meta}>{tripDestination}</Text>

          <View style={styles.statsRow}>
            <StatCard value={String(currentTrip?.members_count ?? crew.length)} label="Crew" />
            <StatCard value={String(itineraryDays.length)} label="Days" />
            <StatCard value={String(totalPlans)} label="Plans" />
          </View>

          <View style={styles.memberList}>
            {crew.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.role || 'Crew member'}</Text>
              </View>
            ))}
          </View>

          <View style={styles.leadCard}>
            <Text style={styles.leadLabel}>Trip lead</Text>
            <Text style={styles.leadName}>{tripLead?.name || crew[0]?.name || 'Pending'}</Text>
          </View>
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton title="View Itinerary" onPress={() => navigation.navigate('Itinerary')} />
          <PrimaryButton
            title="Split Expenses"
            variant="secondary"
            onPress={() => navigation.navigate('AddExpense')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  hero: {
    height: 220,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  trip: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  memberList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberRole: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  leadCard: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#EEF4FF',
    padding: spacing.md,
  },
  leadLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  leadName: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.sm,
  },
});
