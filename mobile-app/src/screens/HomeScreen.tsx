import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { ItineraryDay, isCompletedEvent, useTripStore } from '../store/tripStore';
import { ApiNotification, ApiTrip, apiRequest, fetchNotifications, fetchTripDetails, fetchTrips, tripCoverFileUrl } from '../config/api';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { prototypeImages } from '../utils/prototypeAssets';
import { formatTripRange, isTripActive, isTripUpcoming, mapApiMembersToCrew, pickPrimaryTrip, tripTimelineStatus } from '../utils/tripFlow';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);

  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [primaryTripItinerary, setPrimaryTripItinerary] = useState<ItineraryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadHome = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }
      const [tripResponse, notificationResponse] = await Promise.all([fetchTrips(), fetchNotifications()]);
      const nextTrips = Array.isArray(tripResponse.trips) ? tripResponse.trips : [];
      const nextPrimaryTrip = pickPrimaryTrip(nextTrips);
      setTrips(nextTrips);
      setNotifications(Array.isArray(notificationResponse.notifications) ? notificationResponse.notifications : []);
      if (nextPrimaryTrip?.id) {
        try {
          const itineraryResponse = await apiRequest<{ days: ItineraryDay[] }>(`/api/trips/${nextPrimaryTrip.id}/itinerary`);
          setPrimaryTripItinerary(Array.isArray(itineraryResponse.days) ? itineraryResponse.days : []);
        } catch (error) {
          console.log('Home itinerary load failed', error);
          setPrimaryTripItinerary([]);
        }
      } else {
        setPrimaryTripItinerary([]);
      }
      hasLoadedRef.current = true;
    } catch (error) {
      console.log('Home load failed', error);
      if (!hasLoadedRef.current) {
        setTrips([]);
        setNotifications([]);
        setPrimaryTripItinerary([]);
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome(!hasLoadedRef.current);
    }, [loadHome])
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }, []);

  const primaryTrip = useMemo(() => pickPrimaryTrip(trips), [trips]);
  const upcomingTrips = useMemo(
    () => trips.filter((trip) => trip.id !== primaryTrip?.id && isTripUpcoming(trip)).slice(0, 4),
    [primaryTrip?.id, trips]
  );
  const showNextEvent = Boolean(primaryTrip && isTripActive(primaryTrip));

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

  const activityItems = useMemo(
    () => notifications.filter((item) => !item.requiresAction).slice(0, 3),
    [notifications]
  );

  const fallbackActivityItems = useMemo(() => {
    return primaryTripItinerary
      .flatMap((day) =>
        day.events.map((event) => {
          // Use the actual event title for completed events rather than a generic label.
          const statusLabel = isCompletedEvent(event)
            ? `${event.title} completed`
            : event.status === 'active'
              ? `${event.title} in progress`
              : `${event.title} upcoming`;
          return {
            id: `${day.id}-${event.id}`,
            title: statusLabel,
            body: `${event.title} • ${day.title} • ${event.time}`,
          };
        })
      )
      .slice(0, 3);
  }, [primaryTripItinerary]);

  const nextEvent = useMemo(() => {
    for (const day of primaryTripItinerary) {
      const activeEvent = day.events.find((event) => !isCompletedEvent(event) && event.status === 'active');
      if (activeEvent) {
        return { day, event: activeEvent };
      }
      const upcomingEvent = day.events.find((event) => !isCompletedEvent(event) && event.status === 'upcoming');
      if (upcomingEvent) {
        return { day, event: upcomingEvent };
      }
    }
    return null;
  }, [primaryTripItinerary]);

  const openLocationOptions = async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedQuery)}`;
    const appleMapsUrl = `http://maps.apple.com/?q=${encodeURIComponent(trimmedQuery)}`;

    Alert.alert('Open location', trimmedQuery, [
      {
        text: 'Google Maps',
        onPress: async () => {
          try {
            await Linking.openURL(googleMapsUrl);
          } catch {
            Alert.alert('Maps unavailable', 'Could not open Google Maps right now.');
          }
        },
      },
      {
        text: 'Apple Maps',
        onPress: async () => {
          try {
            await Linking.openURL(appleMapsUrl);
          } catch {
            Alert.alert('Maps unavailable', 'Could not open Apple Maps right now.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{user?.name || user?.email || 'Traveler'}</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={() => navigation.navigate('CreateGroup')} style={styles.headerButton}>
              <Ionicons name="add" size={21} color={colors.accent} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.headerButton}>
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {notifications.length > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          </View>
        </View>

        {loading && trips.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : primaryTrip ? (
          <Pressable onPress={() => openTrip(primaryTrip)} style={styles.activeCard}>
            <Image
              source={
                primaryTrip.image_url && token
                  ? ({ uri: tripCoverFileUrl(primaryTrip.id), headers: { Authorization: `Bearer ${token}` }, cache: 'force-cache' } as any)
                  : prototypeImages.tripHero
              }
              style={styles.activeImage}
            />
            <View style={styles.activeOverlay} />
            <View style={styles.activeContent}>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{tripTimelineStatus(primaryTrip)}</Text>
              </View>
              <Text style={styles.activeTitle}>{primaryTrip.name}</Text>
              <Text style={styles.activeMeta}>
                {formatTripRange(primaryTrip.start_date, primaryTrip.end_date)} · {primaryTrip.members_count ?? 1} members
              </Text>
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.navigate('CreateGroup')} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Start your first trip</Text>
            <Text style={styles.emptyCopy}>Create a group and the whole trip flow will open from there.</Text>
          </Pressable>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            <Pressable onPress={() => navigation.navigate('Trips')}>
              <Text style={styles.sectionLink}>See all</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {upcomingTrips.length > 0 ? (
              upcomingTrips.map((trip) => (
                <Pressable key={trip.id} onPress={() => openTrip(trip)} style={styles.upcomingCard}>
                  <Text style={styles.upcomingTitle}>{trip.name}</Text>
                  <Text style={styles.upcomingMeta}>{formatTripRange(trip.start_date, trip.end_date)}</Text>
                  <Text style={styles.upcomingSupport}>{trip.members_count ?? 1} members</Text>
                </Pressable>
              ))
            ) : (
              <View style={styles.upcomingCard}>
                <Text style={styles.upcomingTitle}>No upcoming trips yet</Text>
                <Text style={styles.upcomingMeta}>Create a group to start planning one.</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {showNextEvent ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Event</Text>
            {nextEvent ? (
              <View style={styles.nextEventCard}>
                <View style={styles.nextEventHeader}>
                  <View style={styles.nextEventBadge}>
                    <Text style={styles.nextEventBadgeText}>{nextEvent.day.title}</Text>
                  </View>
                  <Text style={styles.nextEventTime}>{nextEvent.event.time}</Text>
                </View>
                <Text style={styles.nextEventTitle}>{nextEvent.event.title}</Text>
                <Text style={styles.nextEventMeta}>{nextEvent.event.notes || nextEvent.event.location}</Text>
                <Pressable style={styles.locationButton} onPress={() => openLocationOptions(nextEvent.event.location)}>
                  <Ionicons name="location-outline" size={16} color={colors.accent} />
                  <Text style={styles.locationButtonText}>Maps</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.nextEventCard}>
                <Text style={styles.nextEventTitle}>No itinerary event yet</Text>
                <Text style={styles.nextEventMeta}>Your next stop will appear here after you add events to the trip.</Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityList}>
            {activityItems.length > 0 ? (
              activityItems.map((item) => (
                <View key={item.id} style={styles.activityRow}>
                  <View style={styles.activityAvatar}>
                    <Text style={styles.activityAvatarText}>{item.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityText}>{item.title}</Text>
                    <Text style={styles.activitySubtext}>{item.body}</Text>
                  </View>
                </View>
              ))
            ) : fallbackActivityItems.length > 0 ? (
              fallbackActivityItems.map((item) => (
                <View key={item.id} style={styles.activityRow}>
                  <View style={styles.activityAvatar}>
                    <Text style={styles.activityAvatarText}>{item.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityText}>{item.title}</Text>
                    <Text style={styles.activitySubtext}>{item.body}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.activityRow}>
                <View style={styles.activityAvatar}>
                  <Text style={styles.activityAvatarText}>T</Text>
                </View>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityText}>Trip activity will appear here</Text>
                  <Text style={styles.activitySubtext}>New events, expenses, and updates will show up as your crew uses the app.</Text>
                </View>
              </View>
            )}
          </View>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  name: {
    marginTop: 2,
    fontSize: 30,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  loadingCard: {
    minHeight: 180,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCard: {
    minHeight: 176,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  activeImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.48)',
  },
  activeContent: {
    padding: 20,
    justifyContent: 'flex-end',
    flex: 1,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  activeTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  activeMeta: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
  },
  emptyCard: {
    minHeight: 176,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  emptyCopy: {
    marginTop: 8,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalList: {
    gap: spacing.md,
  },
  upcomingCard: {
    width: 208,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  upcomingTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  upcomingMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  upcomingSupport: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 11,
  },
  nextEventCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  nextEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nextEventBadge: {
    borderRadius: radius.pill,
    backgroundColor: '#E7F0FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  nextEventBadgeText: {
    color: colors.accentStrong,
    fontSize: 11,
    fontWeight: '800',
  },
  nextEventTime: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  nextEventTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  nextEventMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  locationButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 220,
  },
  activityList: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  activityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E7F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarText: {
    color: colors.accentStrong,
    fontSize: 13,
    fontWeight: '800',
  },
  activityCopy: {
    flex: 1,
  },
  activityText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  activitySubtext: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
