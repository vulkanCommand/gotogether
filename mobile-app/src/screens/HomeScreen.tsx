import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { CrewMember, ItineraryDay, useTripStore } from '../store/tripStore';
import { apiRequest, ApiTrip, fetchTripDetails, fetchTripSetupStatus, fetchTrips } from '../config/api';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

type HomeOverview = {
  trip: ApiTrip;
  crew: CrewMember[];
  days: ItineraryDay[];
  setupRequired: boolean;
};

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

const pickHomeTrip = (trips: ApiTrip[]) => {
  const today = todayValue();
  const active = trips
    .filter((trip) => !trip.completed_at && dateValue(trip.start_date) <= today && dateValue(trip.end_date) >= today)
    .sort((a, b) => dateValue(b.start_date) - dateValue(a.start_date));
  if (active[0]) {
    return active[0];
  }

  const upcoming = trips
    .filter((trip) => !trip.completed_at)
    .sort((a, b) => dateValue(a.start_date) - dateValue(b.start_date));
  if (upcoming[0]) {
    return upcoming[0];
  }

  const recentlyEnded = trips
    .filter((trip) => !trip.completed_at)
    .sort((a, b) => dateValue(b.end_date) - dateValue(a.end_date));
  if (recentlyEnded[0]) {
    return recentlyEnded[0];
  }

  return trips
    .filter((trip) => trip.completed_at)
    .sort((a, b) => dateValue(b.end_date) - dateValue(a.end_date))[0] ?? null;
};

const openMapsLocation = async (value?: string) => {
  const query = value?.trim();
  if (!query) {
    return;
  }
  try {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  } catch {
    Alert.alert('Maps unavailable', 'Could not open this location in Maps.');
  }
};

const shouldShowLocationIcon = (location?: string, locationIsMapped?: boolean) => {
  const normalized = location?.trim() ?? '';
  if (!normalized || normalized.toLowerCase() === 'location tbd') {
    return false;
  }
  return Boolean(locationIsMapped || normalized.includes(','));
};

export default function HomeScreen({ navigation }: Props) {
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setItineraryDays = useTripStore((state) => state.setItineraryDays);
  const setTripLead = useTripStore((state) => state.setTripLead);

  const hydrateTrip = useCallback(
    async (trip: ApiTrip) => {
      const details = await fetchTripDetails(trip.id);
      const setup = await fetchTripSetupStatus(trip.id);
      const itinerary = await apiRequest<{ days: ItineraryDay[] }>(`/api/trips/${trip.id}/itinerary`);
      const crew = details.members.map((member) => ({
        id: String(member.id),
        name: member.name,
        role: member.role,
      }));
      const lead = crew.find((member) => member.role === 'lead') ?? null;

      setCurrentTrip(details.trip);
      setCrew(crew);
      setTripLead(lead);
      setItineraryDays(Array.isArray(itinerary.days) ? itinerary.days : []);

      return {
        trip: details.trip,
        crew,
        days: Array.isArray(itinerary.days) ? itinerary.days : [],
        setupRequired: Boolean(setup.required),
      };
    },
    [setCrew, setCurrentTrip, setItineraryDays, setTripLead]
  );

  const fetchHomeData = useCallback(async () => {
    try {
      if (!token) {
        setOverview(null);
        return;
      }

      setLoading(true);
      const response = await fetchTrips();
      const selectedTrip = pickHomeTrip(Array.isArray(response.trips) ? response.trips : []);
      if (!selectedTrip) {
        setOverview(null);
        setCurrentTrip(null);
        setCrew([]);
        setItineraryDays([]);
        setTripLead(null);
        return;
      }

      setOverview(await hydrateTrip(selectedTrip));
    } catch (err) {
      console.log('Home overview fetch error', err);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [hydrateTrip, setCrew, setCurrentTrip, setItineraryDays, setTripLead, token]);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  useFocusEffect(
    useCallback(() => {
      fetchHomeData();
    }, [fetchHomeData])
  );

  const nextPlan = useMemo(() => {
    if (!overview) {
      return null;
    }
    for (const day of overview.days) {
      const active = day.events.find((event) => event.status === 'active');
      if (active) {
        return { day: day.title, event: active };
      }
      const upcoming = day.events.find((event) => event.status === 'upcoming');
      if (upcoming) {
        return { day: day.title, event: upcoming };
      }
    }
    return null;
  }, [overview]);

  const completedPlans = useMemo(
    () => overview?.days.reduce((sum, day) => sum + day.events.filter((event) => event.status === 'completed').length, 0) ?? 0,
    [overview]
  );
  const totalPlans = useMemo(() => overview?.days.reduce((sum, day) => sum + day.events.length, 0) ?? 0, [overview]);
  const lead = overview?.crew.find((member) => member.role === 'lead') ?? null;

  const openTrip = () => {
    if (!overview) {
      navigation.navigate('CreateGroup');
      return;
    }
    setCurrentTrip(overview.trip);
    setCrew(overview.crew);
    setItineraryDays(overview.days);
    setTripLead(lead);
    navigation.navigate(overview.setupRequired ? 'TripSetup' : 'TripOverview');
  };

  const openProtectedScreen = (screen: 'Itinerary' | 'AddExpense') => {
    if (!overview) {
      return;
    }
    setCurrentTrip(overview.trip);
    setCrew(overview.crew);
    setItineraryDays(overview.days);
    setTripLead(lead);
    navigation.navigate(overview.setupRequired ? 'TripSetup' : screen);
  };

  const openLiveMap = () => {
    if (!overview || !nextPlan) {
      return;
    }
    setCurrentTrip(overview.trip);
    setCrew(overview.crew);
    setItineraryDays(overview.days);
    setTripLead(lead);
    navigation.navigate('Live');
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle
        title="Home"
        subtitle={`Welcome ${user?.name || user?.email || 'back'}`}
        action={<NotificationBell />}
      />

      {!overview ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No trip overview yet</Text>
          <Text style={styles.emptyText}>
            Create a group and your current trip overview will show here when you open the app.
          </Text>
          <View style={styles.cardAction}>
            <PrimaryButton title="Create Group" onPress={() => navigation.navigate('CreateGroup')} />
          </View>
        </AppCard>
      ) : (
        <>
          <AppCard>
            <View style={styles.overviewHeader}>
              <View style={styles.tripInfo}>
                <Text style={styles.label}>Current trip overview</Text>
                <Text style={styles.tripTitle}>{overview.trip.name}</Text>
                <Text style={styles.meta}>
                  {overview.trip.start_date} - {overview.trip.end_date}
                </Text>
                <Pressable onPress={() => openMapsLocation(overview.trip.destination)}>
                  <Text style={[styles.meta, styles.locationLink]}>{overview.trip.destination}</Text>
                </Pressable>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{overview.trip.completed_at ? 'Completed' : overview.setupRequired ? 'Setup' : 'Live'}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatCard value={String(overview.trip.members_count ?? overview.crew.length)} label="Crew" />
              <StatCard value={String(overview.days.length)} label="Days" />
              <StatCard value={`${completedPlans}/${totalPlans}`} label="Plans done" />
            </View>

            <Pressable style={styles.nextCard} onPress={openLiveMap} disabled={!nextPlan || overview.setupRequired}>
              <Text style={styles.label}>Next up</Text>
              {nextPlan ? (
                <>
                  <Text style={styles.nextTitle}>{nextPlan.event.title}</Text>
                  <Text style={styles.nextMeta}>
                    {nextPlan.day} - {nextPlan.event.time}
                  </Text>
                  {shouldShowLocationIcon(nextPlan.event.location, nextPlan.event.locationIsMapped) ? (
                    <Pressable
                      style={styles.locationIcon}
                      onPress={() => openMapsLocation(nextPlan.event.location)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${nextPlan.event.location} in Maps`}
                    >
                      <Ionicons name="location" size={22} color={colors.accent} />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => openMapsLocation(nextPlan.event.location)}>
                      <Text style={styles.nextLocation}>{nextPlan.event.location}</Text>
                    </Pressable>
                  )}
                  <Text style={styles.mapHint}>Tap to open live map</Text>
                </>
              ) : overview.setupRequired ? (
                <Text style={styles.nextMeta}>Finish your availability and lead vote before planning starts.</Text>
              ) : (
                <Text style={styles.nextMeta}>No upcoming itinerary event yet.</Text>
              )}
            </Pressable>

            <View style={styles.leadCard}>
              <Text style={styles.label}>Trip lead</Text>
              <Text style={styles.leadName}>{lead?.name || 'Lead vote pending'}</Text>
            </View>
          </AppCard>

          <View style={styles.actions}>
            <PrimaryButton title={overview.setupRequired ? 'Finish Setup' : 'Open Trip'} onPress={openTrip} />
            <PrimaryButton title="View Itinerary" variant="secondary" onPress={() => openProtectedScreen('Itinerary')} />
            <PrimaryButton title="Split Expenses" variant="secondary" onPress={() => openProtectedScreen('AddExpense')} />
          </View>

          <AppCard>
            <Text style={styles.label}>Crew</Text>
            <View style={styles.crewList}>
              {overview.crew.map((member) => (
                <View key={member.id} style={styles.crewRow}>
                  <Text style={styles.crewName}>{member.name}</Text>
                  <Text style={styles.crewRole}>{member.role || 'member'}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        </>
      )}
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
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tripInfo: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  tripTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 5,
    fontSize: 14,
    color: colors.textSecondary,
  },
  locationLink: {
    color: colors.accent,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  statusPill: {
    borderRadius: radius.pill,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  nextCard: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  nextTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  nextMeta: {
    marginTop: 6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  nextLocation: {
    marginTop: 6,
    color: colors.accent,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  locationIcon: {
    marginTop: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHint: {
    marginTop: spacing.sm,
    color: colors.accent,
    fontWeight: '900',
  },
  leadCard: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#EEF4FF',
    padding: spacing.md,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.sm,
  },
  crewList: {
    gap: spacing.sm,
  },
  crewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  crewName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  crewRole: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cardAction: {
    marginTop: spacing.md,
  },
});
