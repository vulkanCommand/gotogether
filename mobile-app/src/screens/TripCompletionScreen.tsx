import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { useTripStore } from '../store/tripStore';
import { API_BASE_URL, ApiExpenseGroup, completeTrip, createTripPhoto, fetchExpenseGroups, fetchTripDetails, fetchTripPhotos } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { mapApiMembersToCrew } from '../utils/tripFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'TripCompletion'>;

type TripPhoto = {
  id: number;
  image_url: string;
  caption: string;
  uploaded_by: string;
  uploaded_at: string;
};

export default function TripCompletionScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const crew = useTripStore((state) => state.crew);
  const bestMatchRange = useTripStore((state) => state.bestMatchRange);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const tripLead = useTripStore((state) => state.tripLead);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const selectedDestination = useTripStore((state) => state.selectedDestination);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);
  const resetTrip = useTripStore((state) => state.resetTrip);

  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [expenseGroups, setExpenseGroups] = useState<ApiExpenseGroup[]>([]);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);

  const destination = selectedDestination();
  const canCompleteTrip = currentTrip?.viewer_role === 'lead';
  const isCompleted = Boolean(currentTrip?.completed_at);

  const refreshTripState = useCallback(async () => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      const details = await fetchTripDetails(currentTrip.id);
      const nextCrew = mapApiMembersToCrew(details.members);
      setCurrentTrip(details.trip);
      setCrew(nextCrew);
      setTripLead(nextCrew.find((member) => member.role === 'lead') ?? nextCrew[0] ?? null);
    } catch (error) {
      console.log('Refresh trip completion state failed', error);
    }
  }, [currentTrip?.id, setCrew, setCurrentTrip, setTripLead]);

  const loadPhotos = useCallback(async () => {
    if (!currentTrip?.id) {
      setPhotos([]);
      return;
    }

    try {
      const response = await fetchTripPhotos(currentTrip.id);
      setPhotos(response.photos);
    } catch (error) {
      console.log('Fetch trip photos failed', error);
      setPhotos([]);
    }
  }, [currentTrip?.id]);

  const loadExpenseGroups = useCallback(async () => {
    if (!currentTrip?.id) {
      setExpenseGroups([]);
      return;
    }

    try {
      const response = await fetchExpenseGroups(currentTrip.id);
      setExpenseGroups(Array.isArray(response.groups) ? response.groups : []);
    } catch (error) {
      console.log('Fetch expense groups failed', error);
      setExpenseGroups([]);
    }
  }, [currentTrip?.id]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    loadExpenseGroups();
  }, [loadExpenseGroups]);

  useEffect(() => {
    refreshTripState();
  }, [refreshTripState]);

  const members = useMemo(() => {
    if (crew.length === 0 && user) {
      return [{ id: String(user.id), name: user.name || user.email }];
    }

    return crew;
  }, [crew, user]);

  const handleUploadPhoto = async () => {
    if (!currentTrip?.id || !user) {
      Alert.alert('No trip selected', 'Open a trip first before uploading photos.');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow media access to upload trip photos.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (picked.canceled || !picked.assets[0]?.uri) {
        return;
      }

      setUploading(true);
      const asset = picked.assets[0];

      await createTripPhoto(currentTrip.id, {
        photo: {
          uri: asset.uri,
          name: asset.fileName || `trip-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        },
        caption: `${destination?.name || currentTrip.name} memory`,
      });

      await loadPhotos();
    } catch (error: any) {
      console.log('Photo upload failed', error);
      Alert.alert('Upload failed', error?.message || 'Could not upload trip photo');
    } finally {
      setUploading(false);
    }
  };

  const tripMeta = [
    bestMatchRange || 'Dates pending',
    currentTrip?.destination ||
      (destination?.country ? `${destination.name}, ${destination.country}` : destination?.name ?? 'Destination pending'),
  ].join(' - ');

  const allExpenses = expenseGroups.flatMap((group) => group.expenses);
  const tripSpendTotal = allExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalEventCount = itineraryDays.reduce((sum, day) => sum + day.events.length, 0);
  const completedEventCount = itineraryDays.reduce(
    (sum, day) => sum + day.events.filter((event) => event.status === 'completed').length,
    0
  );
  const primaryPhoto = photos[0] ?? null;
  const canFinalizeTrip = canCompleteTrip && !isCompleted && photos.length > 0;

  const handleFinish = async () => {
    if (!canCompleteTrip) {
      Alert.alert('Trip lead only', 'Only the trip lead can start trip completion.');
      navigation.navigate('MainTabs', { screen: 'Trips' });
      return;
    }

    if (completing) {
      return;
    }

    try {
      setCompleting(true);
      if (currentTrip?.id) {
        await completeTrip(currentTrip.id);
        await refreshTripState();
      }
      resetTrip();
      navigation.navigate('MainTabs', { screen: 'Trips', params: { initialSection: 'Completed' } });
    } catch (error: any) {
      Alert.alert('Complete failed', error?.message || 'Could not complete this trip');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Screen showFooter showBackButton>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionTitle
          title="Trip Completion"
          subtitle={isCompleted ? 'A warm look back at the trip you wrapped up together.' : 'Build the final trip story, add a group photo, then finish the trip.'}
          action={<NotificationBell />}
        />

        <AppCard style={styles.heroCard}>
          <Text style={styles.emoji}>{isCompleted ? 'Memories saved' : 'Final trip story'}</Text>
          <Text style={styles.heroTitle}>{isCompleted ? 'Trip Completed!' : 'Finish the Trip'}</Text>
          <Text style={styles.tripName}>{currentTrip?.name ?? destination?.name ?? 'Your Trip'}</Text>
          <Text style={styles.tripMeta}>{tripMeta}</Text>

          <View style={styles.statsRow}>
            <StatCard value={String(members.length)} label="Crew" />
            <StatCard value={String(totalEventCount)} label="Events" />
            <StatCard value={`$${tripSpendTotal.toFixed(0)}`} label="Spend" />
          </View>
        </AppCard>

        {primaryPhoto ? (
          <AppCard>
            <Text style={styles.sectionEyebrow}>{isCompleted ? 'Group photo' : 'Cover memory'}</Text>
            <View style={styles.photoCard}>
              <Image
                source={{
                  uri: `${API_BASE_URL}/api/trips/${currentTrip?.id}/photos/${primaryPhoto.id}/file`,
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }}
                style={styles.photoImage}
              />
              <Text style={styles.photoCaption}>{primaryPhoto.caption || `${currentTrip?.name ?? 'Trip'} memory`}</Text>
              <Text style={styles.photoMeta}>
                {primaryPhoto.uploaded_by || 'Crew'} - {primaryPhoto.uploaded_at}
              </Text>
            </View>
          </AppCard>
        ) : null}

        <AppCard>
          <Text style={styles.sectionEyebrow}>{isCompleted ? 'What you lived' : 'Trip overview'}</Text>
          <SummaryRow label="Destination" value={currentTrip?.destination || destination?.name || 'Pending'} />
          <SummaryRow label="Dates" value={bestMatchRange || 'Pending'} />
          <SummaryRow label="Trip lead" value={tripLead?.name || members[0]?.name || 'Pending'} />
          <SummaryRow label="Events completed" value={`${completedEventCount} of ${totalEventCount}`} />
          <SummaryRow label="Expenses logged" value={`${allExpenses.length}`} />
          <SummaryRow label="Total spend" value={`$${tripSpendTotal.toFixed(2)}`} />
          <SummaryRow label="Shared photos" value={`${photos.length}`} isLast />
        </AppCard>

        <AppCard>
          <Text style={styles.sectionEyebrow}>{isCompleted ? 'Trip moments' : 'Add the group photo'}</Text>

          {!isCompleted ? (
            <Pressable style={styles.photoUploadCard} onPress={handleUploadPhoto}>
              <Text style={styles.photoTitle}>
                {uploading ? 'Uploading photo...' : photos.length > 0 ? 'Change the group photo set' : 'Upload a group photo'}
              </Text>
              <Text style={styles.photoSubtitle}>
                Add at least one group photo before finishing so the completed trip feels like a real memory.
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.gallery}>
            {photos.length === 0 ? (
              <Text style={styles.emptyGalleryText}>
                {isCompleted ? 'No photos were saved with this trip.' : 'No trip photos yet. Upload the first one to unlock finishing.'}
              </Text>
            ) : (
              photos.map((photo) => (
                <View key={photo.id} style={styles.photoCard}>
                  <Image
                    source={{
                      uri: `${API_BASE_URL}/api/trips/${currentTrip?.id}/photos/${photo.id}/file`,
                      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    }}
                    style={styles.photoImage}
                  />
                  <Text style={styles.photoCaption}>{photo.caption || 'Trip memory'}</Text>
                  <Text style={styles.photoMeta}>
                    {photo.uploaded_by || 'Crew'} - {photo.uploaded_at}
                  </Text>
                </View>
              ))
            )}
          </View>
        </AppCard>

        <View style={styles.actions}>
          {canCompleteTrip && !isCompleted ? (
            <PrimaryButton
              title={photos.length > 0 ? (completing ? 'Finishing trip...' : 'Finish the Trip') : 'Upload Group Photo to Finish'}
              onPress={handleFinish}
              disabled={!canFinalizeTrip || completing}
            />
          ) : null}
          <PrimaryButton title="Back to Trips" variant="secondary" onPress={() => navigation.navigate('MainTabs', { screen: 'Trips' })} />
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

function SummaryRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, isLast && styles.summaryRowLast]}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  heroCard: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tripName: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tripMeta: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEF2F7',
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
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryRowLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  photoUploadCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: '#F8FAFC',
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  photoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  photoSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  gallery: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  emptyGalleryText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  photoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photoImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#E5E7EB',
  },
  photoCaption: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  photoMeta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 12,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
});

