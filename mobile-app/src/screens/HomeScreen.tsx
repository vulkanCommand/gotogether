import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import GTBadge from '../components/GTBadge';
import GTButton from '../components/GTButton';
import GTCard from '../components/GTCard';
import GTEmptyState from '../components/GTEmptyState';
import GTLoadingSkeleton from '../components/GTLoadingSkeleton';
import GTSectionHeader from '../components/GTSectionHeader';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { ItineraryDay, useTripStore } from '../store/tripStore';
import {
  ApiActivityItem,
  ApiTrip,
  apiRequest,
  fetchExpenseGroups,
  fetchNotifications,
  fetchRecentActivity,
  fetchTripDetails,
  fetchTrips,
  tripCoverFileUrl,
} from '../config/api';
import { colors, gradients } from '../theme/colors';
import { footerScrollPadding, radius, shadows, spacing } from '../theme/spacing';
import { calculateOverallExpenseSummary, formatMoney, getBalanceDisplay } from '../utils/expenseCalculations';
import { formatNotificationDisplay } from '../utils/notificationDisplay';
import { prototypeImages } from '../utils/prototypeAssets';
import { formatTripRange, isTripActive, isTripUpcoming, mapApiMembersToCrew, pickPrimaryTrip, tripTimelineStatus } from '../utils/tripFlow';
import { CACHE_TTLS, cacheKeys, isCacheFresh, readCachedValue, writeCachedValue } from '../services/resourceCache';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

type HomeActivityItem = {
  id: number | string;
  title: string;
  body: string;
  type?: string;
  tripId?: number;
};

type ExpenseSnapshot = {
  amount: number;
  label: string;
  headline: string;
  isPositive: boolean;
  isSettled: boolean;
  tripName?: string;
};

type HomeCacheSnapshot = {
  activities: ApiActivityItem[];
  expenseSnapshot: ExpenseSnapshot | null;
  primaryTripItinerary: ItineraryDay[];
  trips: ApiTrip[];
  unreadCount: number;
};

export default function HomeScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);

  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [activities, setActivities] = useState<ApiActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [primaryTripItinerary, setPrimaryTripItinerary] = useState<ItineraryDay[]>([]);
  const [expenseSnapshot, setExpenseSnapshot] = useState<ExpenseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const lastFetchedRef = useRef(0);

  const applyHomeSnapshot = useCallback((snapshot: HomeCacheSnapshot) => {
    setTrips(snapshot.trips);
    setActivities(snapshot.activities);
    setUnreadCount(snapshot.unreadCount);
    setPrimaryTripItinerary(snapshot.primaryTripItinerary);
    setExpenseSnapshot(snapshot.expenseSnapshot);
  }, []);

  const loadHome = useCallback(async (showSpinner = false, force = false) => {
    const cachedHome = await readCachedValue<HomeCacheSnapshot>(cacheKeys.home);

    if (cachedHome && !hasLoadedRef.current) {
      applyHomeSnapshot(cachedHome.value);
      hasLoadedRef.current = true;
      lastFetchedRef.current = cachedHome.updatedAt;
      setLoading(false);
    }

    const shouldFetch = force || !cachedHome || !isCacheFresh(cachedHome.updatedAt, CACHE_TTLS.home);

    if (!shouldFetch) {
      setRefreshing(false);
      return;
    }

    try {
      if (showSpinner) {
        setLoading(true);
      }

      const [tripResponse, activityResponse, notificationResponse] = await Promise.all([
        fetchTrips(),
        fetchRecentActivity(),
        fetchNotifications(),
      ]);
      const nextTrips = Array.isArray(tripResponse.trips) ? tripResponse.trips : [];
      const nextPrimaryTrip = pickPrimaryTrip(nextTrips);
      const notifications = Array.isArray(notificationResponse.notifications) ? notificationResponse.notifications : [];
      let nextDays: ItineraryDay[] = [];
      let nextExpenseSnapshot: ExpenseSnapshot | null = null;

      setTrips(nextTrips);
      setActivities(Array.isArray(activityResponse.activities) ? activityResponse.activities : []);
      setUnreadCount(notifications.filter((item) => !item.readAt).length);

      if (nextPrimaryTrip?.id) {
        try {
          const [itineraryResponse, groupResponse, tripDetails] = await Promise.all([
            apiRequest<{ days: ItineraryDay[] }>(`/api/trips/${nextPrimaryTrip.id}/itinerary`),
            fetchExpenseGroups(nextPrimaryTrip.id),
            fetchTripDetails(nextPrimaryTrip.id),
          ]);
          const resolvedDays = Array.isArray(itineraryResponse.days) ? itineraryResponse.days : [];
          nextDays = resolvedDays;
          setPrimaryTripItinerary(resolvedDays);

          const summary = calculateOverallExpenseSummary(
            groupResponse.groups ?? [],
            mapApiMembersToCrew(tripDetails.members),
            user?.id
          );
          const display = getBalanceDisplay(summary.netBalance);
          nextExpenseSnapshot = {
            amount: display.amount,
            label: display.label,
            headline: display.headline,
            isPositive: display.isPositive,
            isSettled: display.isSettled,
            tripName: nextPrimaryTrip.name,
          };
          setExpenseSnapshot(nextExpenseSnapshot);
        } catch (error) {
          console.log('Home trip detail load failed', error);
          setPrimaryTripItinerary([]);
          setExpenseSnapshot(null);
        }
      } else {
        setPrimaryTripItinerary([]);
        setExpenseSnapshot(null);
      }

      const nextSnapshot: HomeCacheSnapshot = {
        trips: nextTrips,
        activities: Array.isArray(activityResponse.activities) ? activityResponse.activities : [],
        unreadCount: notifications.filter((item) => !item.readAt).length,
        primaryTripItinerary: nextDays,
        expenseSnapshot: nextExpenseSnapshot,
      };

      await writeCachedValue(cacheKeys.home, nextSnapshot);
      hasLoadedRef.current = true;
      lastFetchedRef.current = Date.now();
    } catch (error) {
      console.log('Home load failed', error);
      if (!hasLoadedRef.current) {
        setTrips([]);
        setActivities([]);
        setUnreadCount(0);
        setPrimaryTripItinerary([]);
        setExpenseSnapshot(null);
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [applyHomeSnapshot, user?.id]);

  useFocusEffect(
    useCallback(() => {
      const stale = Date.now() - lastFetchedRef.current > CACHE_TTLS.home;
      loadHome(!hasLoadedRef.current, !hasLoadedRef.current ? false : stale);
    }, [loadHome])
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const primaryTrip = useMemo(() => pickPrimaryTrip(trips), [trips]);

  const upcomingTrips = useMemo(
    () => trips.filter((trip) => trip.id !== primaryTrip?.id && isTripUpcoming(trip)).slice(0, 4),
    [primaryTrip?.id, trips]
  );

  const showNextEvent = Boolean(primaryTrip && isTripActive(primaryTrip));

  const openTrip = async (trip: ApiTrip, destination?: 'TripOverview' | 'Itinerary') => {
    try {
      const details = await fetchTripDetails(trip.id);
      const crew = mapApiMembersToCrew(details.members);

      setCurrentTrip(details.trip);
      setCrew(crew);
      setTripLead(crew.find((member) => member.role === 'lead') ?? crew[0] ?? null);

      if (destination === 'Itinerary') {
        navigation.navigate('Itinerary');
      } else {
        navigation.navigate(details.trip.completed_at ? 'TripCompletion' : 'TripOverview');
      }
    } catch (error) {
      console.log('Open trip failed', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void loadHome(false, true);
  };

  const activityItems = useMemo(
    () =>
      activities
        .filter((item) => !item.requiresAction)
        .slice(0, 5)
        .map((item) => {
          const display = formatNotificationDisplay(item);
          return {
            id: item.id,
            title: display.title,
            body: display.body,
            type: display.type,
            tripId: display.tripId,
          };
        }),
    [activities]
  );

  const nextEvent = useMemo(() => {
    for (const day of primaryTripItinerary) {
      const activeEvent = day.events.find((event) => !event.isCompleted && event.status === 'active');
      if (activeEvent) {
        return { day, event: activeEvent };
      }
      const upcomingEvent = day.events.find((event) => !event.isCompleted && event.status === 'upcoming');
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

  const handleActivityPress = async (item: HomeActivityItem) => {
    if (!item.tripId) {
      if (item.type?.includes('expense') || item.type?.includes('settlement')) {
        navigation.navigate('MainTabs', { screen: 'Expenses' });
      }
      return;
    }

    if (item.type?.includes('expense') || item.type?.includes('settlement')) {
      await openTrip({ ...(primaryTrip as ApiTrip), id: item.tripId } as ApiTrip);
      navigation.navigate('MainTabs', { screen: 'Expenses' });
      return;
    }

    if (item.type?.includes('itinerary')) {
      await openTrip({ ...(primaryTrip as ApiTrip), id: item.tripId } as ApiTrip, 'Itinerary');
      return;
    }

    await openTrip({ ...(primaryTrip as ApiTrip), id: item.tripId } as ApiTrip);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{user?.name || user?.email || 'Traveler'}</Text>
            <Text style={styles.subcopy}>Your trips, plans, and crew updates all in one place.</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={() => navigation.navigate('CreateGroup')} style={styles.headerButton}>
              <Ionicons name="add" size={21} color={colors.accent} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.headerButton}>
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {unreadCount > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          </View>
        </View>

        {loading && trips.length === 0 ? (
          <GTCard style={styles.heroSkeleton}>
            <GTLoadingSkeleton height={18} width={86} radius={999} />
            <GTLoadingSkeleton height={28} width="78%" style={{ marginTop: 18 }} />
            <GTLoadingSkeleton height={14} width="54%" style={{ marginTop: 10 }} />
          </GTCard>
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
              <GTBadge label={tripTimelineStatus(primaryTrip)} tone={tripTimelineStatus(primaryTrip) === 'Active' ? 'green' : 'blue'} />
              <Text style={styles.activeTitle}>{primaryTrip.name}</Text>
              <Text style={styles.activeMeta}>
                {formatTripRange(primaryTrip.start_date, primaryTrip.end_date)} - {primaryTrip.members_count ?? 1} members
              </Text>
            </View>
          </Pressable>
        ) : (
          <GTEmptyState
            icon="airplane-outline"
            title="Start your first trip"
            body="Create a trip group and the whole planning flow opens from there."
            actionLabel="Create trip"
            onPressAction={() => navigation.navigate('CreateGroup')}
          />
        )}

        <View style={styles.quickGrid}>
          <QuickActionTile title="Create Trip" icon="airplane-outline" onPress={() => navigation.navigate('CreateGroup')} />
          <QuickActionTile title="Add Expense" icon="wallet-outline" onPress={() => navigation.navigate('MainTabs', { screen: 'Expenses' })} />
          <QuickActionTile title="Invite Friends" icon="person-add-outline" onPress={() => navigation.navigate('CreateGroup')} />
          <QuickActionTile title="Open Live" icon="navigate-outline" primary onPress={() => navigation.navigate('MainTabs', { screen: 'Live' })} />
        </View>

        <View style={styles.summaryGrid}>
          <GTCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net expenses</Text>
            {expenseSnapshot ? (
              <>
                <Text style={[styles.summaryAmount, expenseSnapshot.isSettled ? styles.summaryAmountNeutral : expenseSnapshot.isPositive ? styles.summaryAmountPositive : styles.summaryAmountWarning]}>
                  {expenseSnapshot.isSettled ? 'Settled up' : formatMoney(expenseSnapshot.amount)}
                </Text>
                <Text style={styles.summaryMeta} numberOfLines={2}>
                  {expenseSnapshot.isSettled
                    ? `${expenseSnapshot.tripName || 'This trip'} is balanced for you right now.`
                    : `${expenseSnapshot.headline.toLowerCase()} on ${expenseSnapshot.tripName || 'your main trip'}.`}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.summaryAmountNeutral}>No data yet</Text>
                <Text style={styles.summaryMeta} numberOfLines={2}>Add expenses to see how much you owe or are owed.</Text>
              </>
            )}
          </GTCard>

          <GTCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Notifications</Text>
            <Text style={styles.summaryAmount}>{unreadCount}</Text>
            <Text style={styles.summaryMeta} numberOfLines={2}>
              {unreadCount > 0 ? 'Unread updates are waiting for you.' : 'You are all caught up right now.'}
            </Text>
          </GTCard>
        </View>

        {showNextEvent ? (
          <View style={styles.section}>
            <GTSectionHeader title="Next event" subtitle="Stay oriented during the trip." />
            {nextEvent ? (
              <GTCard style={styles.nextEventCard}>
                <View style={styles.nextEventHeader}>
                  <GTBadge label={nextEvent.day.title} tone="blue" />
                  <Text style={styles.nextEventTime}>{nextEvent.event.time}</Text>
                </View>
                <Text style={styles.nextEventTitle}>{nextEvent.event.title}</Text>
                <Text style={styles.nextEventMeta}>{nextEvent.event.notes || nextEvent.event.location}</Text>
                <View style={styles.nextEventActions}>
                  <GTButton title="Open itinerary" compact variant="ghost" onPress={() => openTrip(primaryTrip!, 'Itinerary')} />
                  <GTButton title="Maps" icon="location-outline" compact variant="secondary" onPress={() => openLocationOptions(nextEvent.event.location)} />
                </View>
              </GTCard>
            ) : (
              <GTEmptyState
                icon="calendar-outline"
                title="No itinerary event yet"
                body="Your next stop will appear here after you add events to the trip."
                actionLabel="Add itinerary"
                onPressAction={() => openTrip(primaryTrip!, 'Itinerary')}
              />
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <GTSectionHeader
            title="Upcoming trips"
            subtitle={"What's coming next for your crew."}
            actionLabel="See all"
            onPressAction={() => navigation.navigate('Trips')}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {upcomingTrips.length > 0 ? (
              upcomingTrips.map((trip) => (
                <Pressable key={trip.id} onPress={() => openTrip(trip)} style={styles.upcomingCard}>
                  <GTBadge label={tripTimelineStatus(trip)} tone="blue" />
                  <Text style={styles.upcomingTitle}>{trip.name}</Text>
                  <Text style={styles.upcomingMeta}>{formatTripRange(trip.start_date, trip.end_date)}</Text>
                  <Text style={styles.upcomingSupport}>{trip.members_count ?? 1} travelers</Text>
                </Pressable>
              ))
            ) : (
              <GTCard style={styles.noUpcomingCard}>
                <Text style={styles.upcomingTitle}>No upcoming trips yet</Text>
                <Text style={styles.upcomingMeta}>Your next getaway will show up here once you plan it.</Text>
              </GTCard>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <GTSectionHeader
            title="Recent activity"
            subtitle="The latest motion across your trips."
            actionLabel="Notifications"
            onPressAction={() => navigation.navigate('Notifications')}
          />

          <View style={styles.activityList}>
            {activityItems.length > 0 ? (
              activityItems.map((item) => (
                <Pressable key={item.id} onPress={() => void handleActivityPress(item)}>
                  <GTCard style={styles.activityCard}>
                    <View style={styles.activityAvatar}>
                      <Text style={styles.activityAvatarText}>{item.title.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.activityCopy}>
                      <Text style={styles.activityText}>{item.title}</Text>
                      <Text style={styles.activitySubtext}>{item.body}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </GTCard>
                </Pressable>
              ))
            ) : (
              <GTEmptyState
                icon="sparkles-outline"
                title="Trip activity will appear here"
                body="New events, expenses, and crew updates will show up as people use the app."
              />
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
    paddingTop: 44,
    paddingBottom: footerScrollPadding,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentStrong,
  },
  name: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subcopy: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 10px 24px ${colors.shadow}`,
  },
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  heroSkeleton: {
    minHeight: 176,
    justifyContent: 'flex-end',
  },
  activeCard: {
    minHeight: 184,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: `0px 20px 36px ${colors.shadowStrong}`,
  },
  activeImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.42)',
  },
  activeContent: {
    padding: 20,
    justifyContent: 'flex-end',
    flex: 1,
    gap: 6,
  },
  activeTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  activeMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionPressable: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
  },
  quickActionTile: {
    minHeight: 70,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  quickActionTilePrimary: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'transparent',
  },
  quickActionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  quickActionIconWrapPrimary: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  quickActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickActionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  quickActionLabelPrimary: {
    color: '#FFFFFF',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    minHeight: 96,
    padding: 16,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  summaryAmount: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  summaryAmountPositive: {
    color: colors.success,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryAmountWarning: {
    color: colors.warning,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryAmountNeutral: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryMeta: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: spacing.md,
  },
  horizontalList: {
    gap: spacing.md,
  },
  upcomingCard: {
    width: 214,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
    boxShadow: `0px 12px 28px ${colors.shadow}`,
  },
  noUpcomingCard: {
    width: 250,
  },
  upcomingTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  upcomingMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  upcomingSupport: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  nextEventCard: {
    gap: 10,
  },
  nextEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nextEventTime: {
    color: colors.accentStrong,
    fontSize: 13,
    fontWeight: '600',
  },
  nextEventTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  nextEventMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  nextEventActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  activityList: {
    gap: spacing.sm,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarText: {
    color: colors.accentStrong,
    fontSize: 14,
    fontWeight: '600',
  },
  activityCopy: {
    flex: 1,
  },
  activityText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  activitySubtext: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});

function QuickActionTile({
  title,
  icon,
  primary = false,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  onPress: () => void;
}) {
  const content = (
    <View style={[styles.quickActionTile, primary && styles.quickActionTilePrimary]}>
      <View style={[styles.quickActionIconWrap, primary && styles.quickActionIconWrapPrimary]}>
        <Ionicons name={icon} size={21} color={primary ? '#FFFFFF' : colors.accentStrong} />
      </View>
      <View style={styles.quickActionCopy}>
        <Text style={[styles.quickActionLabel, primary && styles.quickActionLabelPrimary]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickActionPressable, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
    >
      {primary ? (
        <LinearGradient
          colors={[...gradients.primaryButton]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quickActionTile}
        >
          <View style={[styles.quickActionIconWrap, styles.quickActionIconWrapPrimary]}>
            <Ionicons name={icon} size={21} color="#FFFFFF" />
          </View>
          <View style={styles.quickActionCopy}>
            <Text style={[styles.quickActionLabel, styles.quickActionLabelPrimary]} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}
