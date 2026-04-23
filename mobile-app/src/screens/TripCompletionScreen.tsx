import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTripStore } from '../store/tripStore';
import { API_BASE_URL, completeTrip, createTripPhoto, fetchTripPhotos } from '../config/api';
import { useAuthStore } from '../store/authStore';

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
  const expenses = useTripStore((state) => state.expenses);
  const tripLead = useTripStore((state) => state.tripLead);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const selectedDestination = useTripStore((state) => state.selectedDestination);
  const totalPlans = useTripStore((state) => state.totalPlans);
  const totalExpenseAmount = useTripStore((state) => state.totalExpenseAmount);
  const resetTrip = useTripStore((state) => state.resetTrip);

  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const destination = selectedDestination();
  const canCompleteTrip = currentTrip?.viewer_role === 'lead';

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

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

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

  const handleFinish = () => {
    if (!canCompleteTrip) {
      Alert.alert('Trip lead only', 'Only the trip lead can start trip completion.');
      navigation.navigate('MainTabs', { screen: 'Trips' });
      return;
    }

    Alert.alert('Are you sure?', 'Start trip completion and ask every crew member to confirm?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            if (currentTrip?.id) {
              const response = await completeTrip(currentTrip.id);
              if (response.pending_confirmations) {
                Alert.alert(
                  'Confirmation sent',
                  'Crew members must accept the completion request in Notifications before this trip moves to Completed.'
                );
                navigation.navigate('MainTabs', { screen: 'Trips' });
                return;
              }
            }
            resetTrip();
            navigation.navigate('MainTabs', { screen: 'Trips' });
          } catch (error: any) {
            Alert.alert('Complete failed', error?.message || 'Could not complete this trip');
          }
        },
      },
    ]);
  };

  return (
    <Screen showFooter>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionTitle
          title="Trip Completion"
          subtitle="Finish the trip with the final summary and a shared photo gallery."
          action={<NotificationBell />}
        />

        <AppCard style={styles.heroCard}>
          <Text style={styles.emoji}>Complete</Text>
          <Text style={styles.heroTitle}>Trip Completed!</Text>
          <Text style={styles.tripName}>{currentTrip?.name ?? destination?.name ?? 'Your Trip'}</Text>
          <Text style={styles.tripMeta}>{tripMeta}</Text>

          <View style={styles.statsRow}>
            <StatCard value={String(members.length)} label="Crew" />
            <StatCard value={String(totalPlans())} label="Plans" />
            <StatCard value={`$${totalExpenseAmount().toFixed(0)}`} label="Spend" />
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.sectionEyebrow}>Trip summary</Text>
          <SummaryRow label="Destination" value={currentTrip?.destination || destination?.name || 'Pending'} />
          <SummaryRow label="Dates" value={bestMatchRange || 'Pending'} />
          <SummaryRow label="Trip lead" value={tripLead?.name || members[0]?.name || 'Pending'} />
          <SummaryRow label="Itinerary events" value={`${itineraryDays.reduce((sum, day) => sum + day.events.length, 0)}`} />
          <SummaryRow label="Expenses logged" value={`${expenses.length}`} isLast />
        </AppCard>

        <AppCard>
          <Text style={styles.sectionEyebrow}>Shared memories</Text>

          <Pressable style={styles.photoUploadCard} onPress={handleUploadPhoto}>
            <Text style={styles.photoTitle}>
              {uploading ? 'Uploading photo...' : 'Upload a group photo'}
            </Text>
            <Text style={styles.photoSubtitle}>
              Photos are saved to the Firebase storage bucket and linked back to this trip.
            </Text>
          </Pressable>

          <View style={styles.gallery}>
            {photos.length === 0 ? (
              <Text style={styles.emptyGalleryText}>No trip photos yet. Upload the first one.</Text>
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
          {canCompleteTrip ? <PrimaryButton title="Finish Trip" onPress={handleFinish} /> : null}
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
