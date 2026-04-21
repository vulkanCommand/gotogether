import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { apiRequest, ApiTrip } from '../config/api';
import { useTripStore } from '../store/tripStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Trips'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function TripsScreen({ navigation }: Props) {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = useAuthStore((state) => state.token);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);

  const fetchTrips = useCallback(async () => {
    try {
      if (!token) {
        setError('No auth token found. Please log in again.');
        setTrips([]);
        return;
      }

      setLoading(true);
      setError('');
      const data = await apiRequest<{ trips: ApiTrip[] }>('/api/trips');
      setTrips(Array.isArray(data.trips) ? data.trips : []);
    } catch (err: any) {
      console.log('Failed to fetch trips', err);
      setError(err?.message || 'Could not connect to backend');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [fetchTrips])
  );

  const formatDateRange = (start: string, end: string) => `${start} → ${end}`;

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle title="Trips" subtitle="All your planning spaces in one place." />

      {error ? (
        <AppCard style={styles.card}>
          <Text style={styles.errorTitle}>Could not load trips</Text>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable style={styles.retryButton} onPress={fetchTrips}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </AppCard>
      ) : null}

      {!error && trips.length === 0 ? (
        <AppCard style={styles.card}>
          <Text style={styles.emptyTitle}>No trips found</Text>
          <Text style={styles.emptyText}>Create a trip to start storing data in the backend.</Text>
        </AppCard>
      ) : null}

      {!error &&
        trips.map((trip) => (
          <Pressable
            key={trip.id}
            onPress={() => {
              setCurrentTrip(trip);
              navigation.navigate('TripOverview');
            }}
          >
            <AppCard style={styles.card}>
              <Text style={styles.title}>{trip.name}</Text>
              <Text style={styles.meta}>{formatDateRange(trip.start_date, trip.end_date)}</Text>

              <View style={styles.bottom}>
                <Text style={styles.destination}>{trip.destination}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Active</Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.members}>{trip.members_count ?? 1} members</Text>
                <Text style={styles.openText}>Open trip</Text>
              </View>
            </AppCard>
          </Pressable>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
  },
  bottom: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  destination: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  members: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  openText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  retryButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  },
});
