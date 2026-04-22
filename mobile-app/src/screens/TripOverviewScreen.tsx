import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { ItineraryDay, useTripStore } from '../store/tripStore';
import { apiRequest, deleteTripCover, fetchTripDetails, fetchTripSetupStatus, tripCoverFileUrl, updateTripCover } from '../config/api';
import { useAuthStore } from '../store/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'TripOverview'>;

const heroImage = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470';

export default function TripOverviewScreen({ navigation }: Props) {
  const {
    currentTrip,
    crew,
    bestMatchRange,
    destinationOptions,
    selectedDestinationId,
    tripLead,
    itineraryDays,
    setCrew,
    setCurrentTrip,
    setItineraryDays,
    setTripLead,
  } = useTripStore();
  const token = useAuthStore((state) => state.token);

  const hydrateTrip = useCallback(async () => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      const response = await fetchTripDetails(currentTrip.id);
      setCurrentTrip(response.trip);
      setCrew(
        response.members.map((member) => ({
          id: String(member.id),
          name: member.name,
          role: member.role,
        }))
      );
      const lead = response.members.find((member) => member.role === 'lead');
      if (lead) {
        setTripLead({ id: String(lead.id), name: lead.name, role: lead.role });
      }
      const setup = await fetchTripSetupStatus(currentTrip.id);
      if (setup.required) {
        navigation.replace('TripSetup');
        return;
      }
      const itinerary = await apiRequest<{ days: ItineraryDay[] }>(`/api/trips/${currentTrip.id}/itinerary`);
      setItineraryDays(Array.isArray(itinerary.days) ? itinerary.days : []);
    } catch (error) {
      console.log('Fetch trip details failed', error);
    }
  }, [currentTrip?.id, navigation, setCrew, setCurrentTrip, setItineraryDays, setTripLead]);

  useEffect(() => {
    hydrateTrip();
  }, [hydrateTrip]);

  const selectedDestination = useMemo(
    () => destinationOptions.find((item) => item.id === selectedDestinationId) ?? null,
    [destinationOptions, selectedDestinationId]
  );

  const totalPlans = itineraryDays.reduce((sum, day) => sum + day.events.length, 0);
  const nextPlan = useMemo(() => {
    for (const day of itineraryDays) {
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
  }, [itineraryDays]);

  const tripName = currentTrip?.name ?? selectedDestination?.name ?? 'Your Trip';
  const tripDates = currentTrip ? `${currentTrip.start_date} - ${currentTrip.end_date}` : bestMatchRange || 'Dates pending';
  const tripDestination =
    currentTrip?.destination ??
    (selectedDestination
      ? selectedDestination.country
        ? `${selectedDestination.name}, ${selectedDestination.country}`
        : selectedDestination.name
      : 'Destination pending');
  const canEditTrip = currentTrip?.viewer_role === 'lead';
  const heroSource =
    currentTrip?.image_url && token
      ? { uri: tripCoverFileUrl(currentTrip.id), headers: { Authorization: `Bearer ${token}` } }
      : { uri: heroImage };

  const pickTripCover = async () => {
    if (!currentTrip?.id || !canEditTrip) {
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Photos permission needed', 'Allow photo access to update the trip picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) {
      return;
    }
    try {
      const asset = result.assets[0];
      const response = await updateTripCover(currentTrip.id, {
        photo: {
          uri: asset.uri,
          name: asset.fileName || 'trip-cover.jpg',
          type: asset.mimeType || 'image/jpeg',
        },
      });
      setCurrentTrip({ ...currentTrip, image_url: response.image_url });
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not update trip photo');
    }
  };

  const removeTripCover = async () => {
    if (!currentTrip?.id || !canEditTrip) {
      return;
    }
    try {
      await deleteTripCover(currentTrip.id);
      setCurrentTrip({ ...currentTrip, image_url: '' });
    } catch (error: any) {
      Alert.alert('Remove failed', error?.message || 'Could not remove trip photo');
    }
  };

  return (
    <Screen showFooter>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionTitle title="Trip Overview" subtitle="Everything your crew needs in one place." action={<NotificationBell />} />

        <Pressable onPress={pickTripCover} disabled={!canEditTrip}>
          <Image source={heroSource} style={styles.hero} />
        </Pressable>
        {canEditTrip ? (
          <View style={styles.coverActions}>
            <Pressable style={styles.smallButton} onPress={pickTripCover}>
              <Text style={styles.smallButtonText}>{currentTrip?.image_url ? 'Change trip photo' : 'Upload trip photo'}</Text>
            </Pressable>
            {currentTrip?.image_url ? (
              <Pressable style={styles.smallButton} onPress={removeTripCover}>
                <Text style={styles.smallButtonText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <AppCard>
          <Text style={styles.trip}>{tripName}</Text>
          <Text style={styles.meta}>{tripDates}</Text>
          <Text style={styles.meta}>{tripDestination}</Text>

          <View style={styles.statsRow}>
            <StatCard value={String(currentTrip?.members_count ?? crew.length)} label="Crew" />
            <StatCard value={String(itineraryDays.length)} label="Days" />
            <StatCard value={String(totalPlans)} label="Plans" />
          </View>

          <View style={styles.nextCard}>
            <Text style={styles.leadLabel}>Next up</Text>
            {nextPlan ? (
              <>
                <Text style={styles.nextTitle}>{nextPlan.event.title}</Text>
                <Text style={styles.nextMeta}>
                  {nextPlan.day} - {nextPlan.event.time} - {nextPlan.event.location}
                </Text>
              </>
            ) : (
              <Text style={styles.nextMeta}>No upcoming itinerary event yet.</Text>
            )}
          </View>

          <View style={styles.memberList}>
            {crew.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.role || 'Crew member'}</Text>
              </View>
            ))}
          </View>

          <View style={styles.leadCard}>
            <Text style={styles.leadLabel}>Trip lead</Text>
            <Text style={styles.leadName}>{tripLead?.name || crew[0]?.name || 'Pending'}</Text>
          </View>
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton title="View Itinerary" onPress={() => navigation.navigate('Itinerary')} />
          <PrimaryButton
            title="Split Expenses"
            variant="secondary"
            onPress={() => navigation.navigate('AddExpense')}
          />
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  hero: {
    height: 220,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  coverActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  trip: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 14,
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
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  memberList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberRole: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  leadCard: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#EEF4FF',
    padding: spacing.md,
  },
  nextCard: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: spacing.md,
  },
  nextTitle: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  nextMeta: {
    marginTop: 6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  leadLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  leadName: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.sm,
  },
});
