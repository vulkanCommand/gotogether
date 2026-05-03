import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { useTripStore } from '../store/tripStore';
import { ApiNotification, ApiTrip, fetchNotifications, fetchTripDetails, fetchTrips, tripCoverFileUrl } from '../config/api';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { prototypeImages } from '../utils/prototypeAssets';
import { formatTripRange, mapApiMembersToCrew, pickPrimaryTrip, tripTimelineStatus } from '../utils/tripFlow';

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
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadHome = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }
      const [tripResponse, notificationResponse] = await Promise.all([fetchTrips(), fetchNotifications()]);
      setTrips(Array.isArray(tripResponse.trips) ? tripResponse.trips : []);
      setNotifications(Array.isArray(notificationResponse.notifications) ? notificationResponse.notifications : []);
      hasLoadedRef.current = true;
    } catch (error) {
      console.log('Home load failed', error);
      if (!hasLoadedRef.current) {
        setTrips([]);
        setNotifications([]);
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
    () => trips.filter((trip) => trip.id !== primaryTrip?.id && !trip.completed_at).slice(0, 4),
    [primaryTrip?.id, trips]
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

  const activityItems = notifications.slice(0, 3);

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
