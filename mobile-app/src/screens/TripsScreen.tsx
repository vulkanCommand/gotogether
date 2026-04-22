import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { ApiTrip, fetchTripDetails, fetchTripSetupStatus, fetchTrips } from '../config/api';
import { useTripStore } from '../store/tripStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Trips'>,
  NativeStackScreenProps<RootStackParamList>
>;

type TripFilter = 'Current' | 'Upcoming' | 'Completed';

const filters: TripFilter[] = ['Current', 'Upcoming', 'Completed'];

const todayValue = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

const dateValue = (value?: string) => {
  if (!value) {
    return 0;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const tripStatus = (trip: ApiTrip): TripFilter => {
  if (trip.completed_at) {
    return 'Completed';
  }
  return dateValue(trip.start_date) > todayValue() ? 'Upcoming' : 'Current';
};

export default function TripsScreen({ navigation }: Props) {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [activeFilter, setActiveFilter] = useState<TripFilter>('Current');
  const [loading, setLoading] = useState(true);
  const [openingTripId, setOpeningTripId] = useState<number | null>(null);

  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);

  const loadTrips = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchTrips();
      setTrips(Array.isArray(response.trips) ? response.trips : []);
    } catch (error) {
      console.log('Trips fetch failed', error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const counts = useMemo(
    () =>
      filters.reduce(
        (acc, filter) => ({
          ...acc,
          [filter]: trips.filter((trip) => tripStatus(trip) === filter).length,
        }),
        {} as Record<TripFilter, number>
      ),
    [trips]
  );

  const visibleTrips = useMemo(
    () =>
      trips
        .filter((trip) => tripStatus(trip) === activeFilter)
        .sort((a, b) => {
          if (activeFilter === 'Completed') {
            return dateValue(b.end_date) - dateValue(a.end_date);
          }
          return dateValue(a.start_date) - dateValue(b.start_date);
        }),
    [activeFilter, trips]
  );

  const openTrip = async (trip: ApiTrip) => {
    try {
      setOpeningTripId(trip.id);
      const details = await fetchTripDetails(trip.id);
      const setup = await fetchTripSetupStatus(trip.id);
      const crew = details.members.map((member) => ({
        id: String(member.id),
        name: member.name,
        role: member.role,
      }));

      setCurrentTrip(details.trip);
      setCrew(crew);
      setTripLead(crew.find((member) => member.role === 'lead') ?? null);
      navigation.navigate(setup.required ? 'TripSetup' : 'TripOverview');
    } catch (error) {
      console.log('Open trip failed', error);
    } finally {
      setOpeningTripId(null);
    }
  };

  return (
    <Screen>
      <SectionTitle
        title="Trips"
        subtitle="Browse your current, upcoming, and completed trip groups."
        action={<NotificationBell />}
      />

      <View style={styles.toggleRow}>
        {filters.map((filter) => {
          const selected = filter === activeFilter;
          return (
            <Pressable key={filter} style={[styles.toggle, selected && styles.toggleSelected]} onPress={() => setActiveFilter(filter)}>
              <Text style={[styles.toggleText, selected && styles.toggleTextSelected]}>{filter}</Text>
              <Text style={[styles.toggleCount, selected && styles.toggleTextSelected]}>{counts[filter] ?? 0}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <AppCard>
          <ActivityIndicator color={colors.accent} />
        </AppCard>
      ) : null}

      {!loading && visibleTrips.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No {activeFilter.toLowerCase()} trips</Text>
          <Text style={styles.emptyText}>
            {activeFilter === 'Current'
              ? 'Trips that are active now will show here.'
              : activeFilter === 'Upcoming'
                ? 'Future trip groups will show here.'
                : 'Completed trips move here after crew confirmation.'}
          </Text>
        </AppCard>
      ) : null}

      <View style={styles.tripList}>
        {visibleTrips.map((trip) => (
          <Pressable key={trip.id} style={styles.tripRow} onPress={() => openTrip(trip)}>
            <View style={styles.tripInfo}>
              <Text style={styles.tripTitle}>{trip.name}</Text>
              <Text style={styles.meta}>
                {trip.start_date} - {trip.end_date}
              </Text>
              <Text style={styles.meta}>{trip.destination}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {openingTripId === trip.id ? 'Opening' : `${trip.members_count ?? 1} people`}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <PrimaryButton title="Create Group" onPress={() => navigation.navigate('CreateGroup')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  toggleTextSelected: {
    color: colors.accent,
  },
  toggleCount: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  tripList: {
    gap: spacing.sm,
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  tripInfo: {
    flex: 1,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  pill: {
    backgroundColor: '#EEF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  pillText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
