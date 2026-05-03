import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { apiRequest, fetchTripDetails, tripCoverFileUrl } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { prototypeImages } from '../utils/prototypeAssets';
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

  const hydrateTrip = useCallback(async () => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      setLoading(true);
      const [details, itinerary] = await Promise.all([
        fetchTripDetails(currentTrip.id),
        apiRequest<{ days: import('../store/tripStore').ItineraryDay[] }>(`/api/trips/${currentTrip.id}/itinerary`),
      ]);

      const nextCrew = mapApiMembersToCrew(details.members);
      setCurrentTrip(details.trip);
      setCrew(nextCrew);
      setTripLead(nextCrew.find((member) => member.role === 'lead') ?? nextCrew[0] ?? null);
      setItineraryDays(Array.isArray(itinerary.days) ? itinerary.days : []);
    } catch (error) {
      console.log('Fetch trip overview failed', error);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id, setCrew, setCurrentTrip, setItineraryDays, setTripLead]);

  useEffect(() => {
    hydrateTrip();
  }, [hydrateTrip]);

  const milestones = useMemo<Milestone[]>(
    () => [
      { label: 'Dates', done: Boolean(currentTrip?.start_date && currentTrip?.end_date) },
      { label: 'Destination', done: Boolean(currentTrip?.destination) },
      { label: 'Lead', done: Boolean(tripLead?.name) },
      { label: 'Itinerary', done: itineraryDays.length > 0 },
    ],
    [currentTrip?.destination, currentTrip?.end_date, currentTrip?.start_date, itineraryDays.length, tripLead?.name]
  );

  const heroSource =
    currentTrip?.image_url && token
      ? { uri: tripCoverFileUrl(currentTrip.id), headers: { Authorization: `Bearer ${token}` }, cache: 'force-cache' }
      : prototypeImages.tripHero;

  const title = currentTrip?.name || 'Trip Overview';
  const destination = currentTrip?.destination || 'Destination pending';
  const travelRange = formatTripRange(currentTrip?.start_date, currentTrip?.end_date);

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <Image source={heroSource as any} style={styles.heroImage} />
          <View style={styles.heroOverlay} />

          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>

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

          <View style={styles.progressCard}>
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
          </View>

          <View style={styles.actionGrid}>
            <Pressable onPress={() => navigation.navigate('Itinerary')} style={styles.actionCard}>
              <Ionicons name="time-outline" size={22} color={colors.accent} />
              <Text style={styles.actionText}>View Itinerary</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('MainTabs', { screen: 'Live' })}
              style={[styles.actionCard, styles.actionCardPrimary]}
            >
              <Ionicons name="location-outline" size={22} color="#FFFFFF" />
              <Text style={styles.actionTextPrimary}>Open Live</Text>
            </Pressable>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Trip lead</Text>
            <Text style={styles.summaryValue}>{tripLead?.name || crew[0]?.name || 'Pending'}</Text>
            <Text style={styles.summaryMeta}>
              {loading
                ? 'Refreshing your trip details...'
                : itineraryDays.length > 0
                  ? `${itineraryDays.length} itinerary day${itineraryDays.length === 1 ? '' : 's'} ready to explore.`
                  : 'Your trip is created. Add itinerary moments next.'}
            </Text>
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
    paddingBottom: 40,
  },
  heroWrap: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 224,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: -36,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.9,
  },
  metaRow: {
    marginTop: spacing.sm,
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
    fontWeight: '800',
  },
  crewMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  progressCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontWeight: '800',
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
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionCardPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionTextPrimary: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    marginTop: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summaryMeta: {
    marginTop: 6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
