import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppFooter from '../components/AppFooter';
import GTCard from '../components/GTCard';
import { RootStackParamList } from '../navigation/AppNavigator';
import { isCompletedEvent, useTripStore } from '../store/tripStore';
import { apiRequest, ensureTripCoverFromDestination, fetchTripDetails, tripCoverFileUrl } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { footerScrollPadding, spacing } from '../theme/spacing';
import { formatTripRange, mapApiMembersToCrew } from '../utils/tripFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'TripOverview'>;

type Milestone = {
  label: string;
  done: boolean;
};

export default function TripOverviewScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const crew = useTripStore((state) => state.crew);
  const tripLead = useTripStore((state) => state.tripLead);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);
  const setItineraryDays = useTripStore((state) => state.setItineraryDays);
  const token = useAuthStore((state) => state.token);

  const [loading, setLoading] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);

  const progressAnimation = useRef(new Animated.Value(0)).current;
  const itineraryDaysRef = useRef(itineraryDays);
  const hydratingRef = useRef(false);
  const hydrationRequestRef = useRef(0);
  const coverRequestRef = useRef(0);

  useEffect(() => {
    itineraryDaysRef.current = itineraryDays;
  }, [itineraryDays]);

  const hydrateTrip = useCallback(async () => {
    if (!currentTrip?.id || hydratingRef.current) {
      return;
    }

    const requestId = hydrationRequestRef.current + 1;
    hydrationRequestRef.current = requestId;

    try {
      hydratingRef.current = true;
      setLoading(true);

      const [details, itinerary] = await Promise.all([
        fetchTripDetails(currentTrip.id),
        apiRequest<{ days: import('../store/tripStore').ItineraryDay[] }>(
          `/api/trips/${currentTrip.id}/itinerary`
        ),
      ]);

      if (hydrationRequestRef.current !== requestId) {
        return;
      }

      const nextCrew = mapApiMembersToCrew(details.members);

      setCurrentTrip(details.trip);
      setCrew(nextCrew);
      setTripLead(nextCrew.find((member) => member.role === 'lead') ?? nextCrew[0] ?? null);

      const nextDays = Array.isArray(itinerary.days) ? itinerary.days : [];

      if (nextDays.length > 0) {
        setItineraryDays(nextDays);
      } else if (itineraryDaysRef.current.length === 0) {
        setItineraryDays([]);
      }
    } catch (error) {
      console.log('Fetch trip overview failed', error);
    } finally {
      if (hydrationRequestRef.current === requestId) {
        hydratingRef.current = false;
        setLoading(false);
      }
    }
  }, [currentTrip?.id, setCrew, setCurrentTrip, setItineraryDays, setTripLead]);

  useFocusEffect(
    useCallback(() => {
      void hydrateTrip();

      return () => {
        hydrationRequestRef.current += 1;
        hydratingRef.current = false;
      };
    }, [hydrateTrip])
  );

  useEffect(() => {
    if (!currentTrip?.id) {
      setCoverLoading(false);
      return;
    }

    if (currentTrip.image_url) {
      setCoverLoading(false);
      return;
    }

    const requestId = coverRequestRef.current + 1;
    coverRequestRef.current = requestId;

    let cancelled = false;

    const fetchCover = async () => {
      try {
        setCoverLoading(true);

        const cover = await ensureTripCoverFromDestination(currentTrip.id);

        if (cancelled || coverRequestRef.current !== requestId) {
          return;
        }

        if (cover.image_url) {
          setCurrentTrip({
            ...currentTrip,
            image_url: cover.image_url,
          });
        }
      } catch (error) {
        console.log('Trip cover fetch failed', error);
      } finally {
        if (!cancelled && coverRequestRef.current === requestId) {
          setCoverLoading(false);
        }
      }
    };

    void fetchCover();

    return () => {
      cancelled = true;
    };
  }, [currentTrip?.id, currentTrip?.image_url, setCurrentTrip]);

  const milestones = useMemo<Milestone[]>(
    () => [
      { label: 'Dates', done: Boolean(currentTrip?.start_date && currentTrip?.end_date) },
      { label: 'Destination', done: Boolean(currentTrip?.destination) },
      { label: 'Lead', done: Boolean(tripLead?.name) },
      { label: 'Itinerary', done: itineraryDays.length > 0 },
    ],
    [currentTrip?.destination, currentTrip?.end_date, currentTrip?.start_date, itineraryDays.length, tripLead?.name]
  );

  const totalEvents = useMemo(
    () => itineraryDays.reduce((sum, day) => sum + day.events.length, 0),
    [itineraryDays]
  );

  const completedEvents = useMemo(
    () =>
      itineraryDays.reduce(
        (sum, day) => sum + day.events.filter((event) => isCompletedEvent(event)).length,
        0
      ),
    [itineraryDays]
  );

  const progressPercent = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;
  const itineraryReady = milestones[milestones.length - 1]?.done;
  const canFinishTrip = Boolean(currentTrip && !currentTrip.completed_at && progressPercent === 100 && totalEvents > 0);

  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: progressPercent,
      duration: 420,
      useNativeDriver: false,
    }).start();
  }, [progressAnimation, progressPercent]);

  const hasHeroImage = Boolean(currentTrip?.image_url && token);

  const heroSource =
    currentTrip?.image_url && token
      ? {
          uri: tripCoverFileUrl(currentTrip.id),
          headers: { Authorization: `Bearer ${token}` },
          cache: 'force-cache',
        }
      : null;

  const title = currentTrip?.name || 'Trip Overview';
  const destination = currentTrip?.destination || 'Destination pending';
  const travelRange = formatTripRange(currentTrip?.start_date, currentTrip?.end_date);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs', {
      screen: 'Home',
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          {hasHeroImage && heroSource ? (
            <>
              <Image source={heroSource as any} style={styles.heroImage} />
              <View style={styles.heroOverlay} />
            </>
          ) : (
            <View style={styles.heroLoading}>
              <View style={styles.heroLoadingIcon}>
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
              <Text style={styles.heroLoadingTitle}>Preparing your trip cover</Text>
              <Text style={styles.heroLoadingMeta}>
                {coverLoading ? 'Fetching the destination image...' : 'Waiting for destination image...'}
              </Text>
            </View>
          )}

          <Pressable onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={hasHeroImage ? '#FFFFFF' : colors.textPrimary} />
          </Pressable>

          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, !hasHeroImage && styles.heroTitleDark]}>{title}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <GTCard style={styles.heroMetaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} /> {travelRange}
            </Text>

            <Text style={styles.metaText}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} /> {destination}
            </Text>
          </View>

          <View style={styles.crewRow}>
            <View style={styles.avatarStack}>
              {crew.slice(0, 5).map((member, index) => (
                <View key={member.id} style={[styles.avatarCircle, { marginLeft: index === 0 ? 0 : -10 }]}>
                  <Text style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.crewMeta}>{crew.length} members</Text>
          </View>
          </GTCard>

          <GTCard style={styles.progressCard}>
            <Text style={styles.progressTitle}>Trip Progress</Text>

            <View style={styles.milestoneRow}>
              {milestones.map((milestone, index) => (
                <View key={milestone.label} style={styles.milestoneItem}>
                  <View style={styles.milestoneHeader}>
                    <View style={[styles.milestoneCircle, milestone.done && styles.milestoneCircleDone]}>
                      {milestone.done ? (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      ) : (
                        <Text style={styles.milestoneNumber}>{index + 1}</Text>
                      )}
                    </View>

                    {index < milestones.length - 1 ? (
                      <View style={[styles.milestoneLine, milestone.done && styles.milestoneLineDone]} />
                    ) : null}
                  </View>

                  <Text style={[styles.milestoneLabel, milestone.done && styles.milestoneLabelDone]}>
                    {milestone.label}
                  </Text>
                </View>
              ))}
            </View>

            {itineraryReady ? (
              <View style={styles.progressSection}>
                <View style={styles.progressSummaryRow}>
                  <Text style={styles.progressPercent}>{progressPercent}%</Text>
                  <Text style={styles.progressSummaryText}>
                    {totalEvents > 0
                      ? `${completedEvents} of ${totalEvents} events completed`
                      : 'Add events to start trip progress'}
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnimation.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>

                {canFinishTrip ? (
                  <Pressable style={styles.finishTripButton} onPress={() => navigation.navigate('TripCompletion')}>
                    <Text style={styles.finishTripButtonText}>Finish the Trip</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </GTCard>

          <View style={styles.actionGrid}>
            <Pressable onPress={() => navigation.navigate('Itinerary')} style={styles.actionCard}>
              <Ionicons name="time-outline" size={22} color={colors.accent} />
              <Text style={styles.actionText}>View Itinerary</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('MainTabs', { screen: 'Expenses' })}
              style={styles.actionCard}
            >
              <Ionicons name="wallet-outline" size={22} color={colors.accent} />
              <Text style={styles.actionText}>Expenses</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('MainTabs', { screen: 'Live' })}
              style={[styles.actionCard, styles.actionCardPrimary]}
            >
              <Ionicons name="location-outline" size={22} color="#FFFFFF" />
              <Text style={styles.actionTextPrimary}>Open Live</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('CreateGroup')}
              style={[styles.actionCard, styles.actionCardInvite]}
            >
              <Ionicons name="person-add-outline" size={22} color={colors.accentStrong} />
              <Text style={styles.actionText}>Invite</Text>
            </Pressable>
          </View>

          <GTCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Trip lead</Text>
            <Text style={styles.summaryValue}>{tripLead?.name || crew[0]?.name || 'Pending'}</Text>
            <Text style={styles.summaryMeta}>
              {loading
                ? 'Refreshing your trip details...'
                : itineraryDays.length > 0
                  ? `${itineraryDays.length} itinerary day${itineraryDays.length === 1 ? '' : 's'} ready to explore.`
                  : 'Your trip is created. Add itinerary moments next.'}
            </Text>
          </GTCard>
        </View>
      </ScrollView>

      <AppFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: footerScrollPadding,
  },
  heroWrap: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 224,
  },
  heroLoading: {
    width: '100%',
    height: 224,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  heroLoadingIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: colors.shadowStrong,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  heroLoadingTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroLoadingMeta: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.34)',
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(15,23,42,0.38)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroTitleDark: {
    color: colors.textPrimary,
    textShadowColor: 'transparent',
  },
  body: {
    marginTop: -36,
    paddingHorizontal: 20,
    gap: spacing.lg,
  },
  heroMetaCard: {
    marginTop: spacing.md,
  },
  metaRow: {
    gap: 8,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.lg,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: '600',
  },
  crewMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  progressCard: {
    paddingTop: spacing.lg,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  milestoneItem: {
    flex: 1,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneCircleDone: {
    backgroundColor: colors.accent,
  },
  milestoneNumber: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  milestoneLine: {
    flex: 1,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  milestoneLineDone: {
    backgroundColor: colors.accent,
  },
  milestoneLabel: {
    marginTop: 8,
    fontSize: 10,
    color: colors.textMuted,
  },
  milestoneLabelDone: {
    color: colors.accent,
    fontWeight: '700',
  },
  progressSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  progressSummaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressPercent: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressSummaryText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    marginTop: spacing.md,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#E7EEF9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  finishTripButton: {
    marginTop: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  finishTripButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionCard: {
    width: '47%',
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
  },
  actionCardPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionCardInvite: {
    backgroundColor: colors.accentSoft,
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionTextPrimary: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryMeta: {
    marginTop: 6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
