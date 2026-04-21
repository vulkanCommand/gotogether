import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { apiRequest, ApiTrip } from '../config/api';
import { useTripStore } from '../store/tripStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
  const [trip, setTrip] = useState<ApiTrip | null>(null);
  const [loading, setLoading] = useState(true);

  const token = useAuthStore((state) => state.token);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);

  const fetchHomeTrip = useCallback(async () => {
    try {
      if (!token) {
        setTrip(null);
        return;
      }

      setLoading(true);
      const data = await apiRequest<{ trips: ApiTrip[] }>('/api/trips');
      setTrip(data.trips?.[0] ?? null);
    } catch (err) {
      console.log('Home fetch error', err);
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHomeTrip();
  }, [fetchHomeTrip]);

  useFocusEffect(
    useCallback(() => {
      fetchHomeTrip();
    }, [fetchHomeTrip])
  );

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle title="Home" subtitle="Your trip dashboard" />

      {!trip ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No active trip</Text>
          <Text style={styles.emptyText}>Create a group and start planning your first trip.</Text>
        </AppCard>
      ) : (
        <AppCard>
          <Text style={styles.label}>Active trip</Text>
          <Text style={styles.tripTitle}>{trip.name}</Text>
          <Text style={styles.meta}>
            {trip.start_date} → {trip.end_date} • {trip.destination}
          </Text>

          <View style={styles.pill}>
            <Text style={styles.pillText}>{trip.members_count ?? 1} members</Text>
          </View>

          <PrimaryButton
            title="Open Trip Overview"
            onPress={() => {
              setCurrentTrip(trip);
              navigation.navigate('TripOverview');
            }}
          />
        </AppCard>
      )}

      <PrimaryButton title="Create Group" onPress={() => navigation.navigate('CreateGroup')} />
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
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
  },
  pill: {
    marginTop: spacing.md,
    backgroundColor: '#EEF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  pillText: {
    color: colors.accent,
    fontSize: 12,
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
