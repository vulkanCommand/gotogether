import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { ApiTrip, fetchTripDetails, fetchTrips, tripCoverFileUrl } from '../config/api';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { prototypeImages } from '../utils/prototypeAssets';
import { formatTripRange, mapApiMembersToCrew, tripTimelineStatus } from '../utils/tripFlow';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Trips'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function TripsScreen({ navigation }: Props) {
  const token = useAuthStore((state) => state.token);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);

  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadTrips = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }
      const response = await fetchTrips();
      setTrips(Array.isArray(response.trips) ? response.trips : []);
      hasLoadedRef.current = true;
    } catch (error) {
      console.log('Trips fetch failed', error);
      if (!hasLoadedRef.current) {
        setTrips([]);
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips(!hasLoadedRef.current);
    }, [loadTrips])
  );

  const sortedTrips = useMemo(
    () =>
      [...trips].sort((a, b) => {
        const aValue = new Date(`${a.start_date}T00:00:00`).getTime();
        const bValue = new Date(`${b.start_date}T00:00:00`).getTime();
        return aValue - bValue;
      }),
    [trips]
  );

  const openTrip = async (trip: ApiTrip) => {
    try {
      const details = await fetchTripDetails(trip.id);
      const crew = mapApiMembersToCrew(details.members);
      setCurrentTrip(details.trip);
      setCrew(crew);
      setTripLead(crew.find((member) => member.role === 'lead') ?? crew[0] ?? null);
      navigation.navigate('TripOverview');
    } catch (error) {
      console.log('Open trip failed', error);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>My Trips</Text>
          <Text style={styles.subtitle}>{trips.length} trips planned</Text>
        </View>

        {loading && trips.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <View style={styles.list}>
            {sortedTrips.map((trip, index) => (
              <Pressable key={trip.id} onPress={() => openTrip(trip)} style={styles.tripCard}>
                <View style={styles.imageWrap}>
                  <Image
                    source={
                      trip.image_url && token
                        ? ({ uri: tripCoverFileUrl(trip.id), headers: { Authorization: `Bearer ${token}` }, cache: 'force-cache' } as any)
                        : index % 3 === 0
                          ? prototypeImages.tripHero
                          : index % 3 === 1
                            ? prototypeImages.alps
                            : prototypeImages.santorini
                    }
                    style={styles.tripImage}
                  />
                  <View style={styles.statusWrap}>
                    <Text style={[styles.statusText, tripTimelineStatus(trip) === 'Active' && styles.statusTextActive]}>
                      {tripTimelineStatus(trip)}
                    </Text>
                  </View>
                </View>
                <View style={styles.tripContent}>
                  <Text style={styles.tripTitle}>{trip.name}</Text>
                  <Text style={styles.tripMeta}>
                    {formatTripRange(trip.start_date, trip.end_date)} · {trip.members_count ?? 1} members
                  </Text>
                </View>
              </Pressable>
            ))}

            {sortedTrips.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No trips yet</Text>
                <Text style={styles.emptyCopy}>Create a group to start your first clear trip flow.</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
  },
  loadingCard: {
    minHeight: 160,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.lg,
  },
  tripCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrap: {
    position: 'relative',
  },
  tripImage: {
    width: '100%',
    height: 144,
  },
  statusWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextActive: {
    color: colors.success,
  },
  tripContent: {
    padding: 16,
  },
  tripTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  tripMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCopy: {
    marginTop: 8,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
