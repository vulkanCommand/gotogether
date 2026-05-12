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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import NotificationBell from '../components/NotificationBell';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { footerScrollPadding, radius, spacing } from '../theme/spacing';
import { isCompletedEvent, useTripStore } from '../store/tripStore';
import {
  API_BASE_URL,
  ApiExpenseGroup,
  completeTrip,
  createTripPhoto,
  deleteTripPhoto,
  fetchExpenseGroups,
  fetchTripDetails,
  fetchTripPhotos,
} from '../config/api';
import { useAuthStore } from '../store/authStore';
import { formatTripRange, mapApiMembersToCrew } from '../utils/tripFlow';
import { invalidateTripCaches } from '../services/resourceCache';

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
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [completing, setCompleting] = useState(false);

  const destination = selectedDestination();
  const canCompleteTrip = currentTrip?.viewer_role === 'lead';
  const isCompleted = Boolean(currentTrip?.completed_at);
  const primaryPhoto = photos[0] ?? null;

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
      setPhotos((response.photos ?? []).slice(0, 1));
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
    if (!currentTrip?.id || !user || uploading) {
      Alert.alert('No trip selected', 'Open a trip first before uploading a memory photo.');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow media access to upload a trip photo.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
        allowsMultipleSelection: false,
      });

      if (picked.canceled || !picked.assets[0]?.uri) {
        return;
      }

      setUploading(true);
      const asset = picked.assets[0];
      const response = await createTripPhoto(currentTrip.id, {
        photo: {
          uri: asset.uri,
          name: asset.fileName || `trip-memory-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        },
        caption: `${destination?.name || currentTrip.name} memory`,
      });

      setPhotos([response.photo]);
    } catch (error: any) {
      console.log('Photo upload failed', error);
      Alert.alert('Upload failed', error?.message || 'Could not upload trip photo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!currentTrip?.id || !primaryPhoto || removingPhoto) {
      return;
    }

    Alert.alert('Remove photo?', 'This will remove the selected memory photo from this trip.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setRemovingPhoto(true);
            await deleteTripPhoto(currentTrip.id, primaryPhoto.id);
            setPhotos([]);
          } catch (error: any) {
            Alert.alert('Remove failed', error?.message || 'Could not remove this photo');
          } finally {
            setRemovingPhoto(false);
          }
        },
      },
    ]);
  };

  const tripDates = formatTripRange(currentTrip?.start_date, currentTrip?.end_date);
  const tripMeta = [
    tripDates,
    currentTrip?.destination ||
      (destination?.country ? `${destination.name}, ${destination.country}` : destination?.name ?? 'Destination pending'),
  ].join(' - ');

  const allExpenses = expenseGroups.flatMap((group) => group.expenses);
  const tripSpendTotal = allExpenses.reduce(
    (sum, expense) =>
      (expense.splitMethod || '').toLowerCase().includes('settlement') ? sum : sum + expense.amount,
    0
  );
  const totalEventCount = itineraryDays.reduce((sum, day) => sum + day.events.length, 0);
  const completedEventCount = itineraryDays.reduce(
    (sum, day) => sum + day.events.filter((event) => isCompletedEvent(event)).length,
    0
  );
  const canFinalizeTrip = canCompleteTrip && !isCompleted && Boolean(primaryPhoto);
  const showMemoryCard = !isCompleted;

  const handleFinish = async () => {
    if (!canCompleteTrip) {
      Alert.alert('Trip lead only', 'Only the trip lead can finish this trip.');
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
        await invalidateTripCaches(currentTrip.id);
        setCurrentTrip({ ...currentTrip, completed_at: currentTrip.completed_at || new Date().toISOString() });
      }

      resetTrip();
      navigation.navigate('MainTabs', { screen: 'Trips', params: { initialSection: 'Completed', refreshToken: Date.now() } });
    } catch (error: any) {
      Alert.alert('Complete failed', error?.message || 'Could not complete this trip');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Screen showFooter showBackButton>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerEyebrow}>{isCompleted ? 'Memory saved' : 'Ready to wrap up'}</Text>
            <Text style={styles.headerTitle}>{isCompleted ? 'Trip completed' : 'Finish trip'}</Text>
          </View>
          <NotificationBell />
        </View>

        <AppCard style={styles.heroCard}>
          {primaryPhoto ? (
            <Image
              source={{
                uri: `${API_BASE_URL}/api/trips/${currentTrip?.id}/photos/${primaryPhoto.id}/file`,
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              }}
              style={styles.heroImage}
            />
          ) : (
            <View style={styles.heroImagePlaceholder}>
              <Ionicons name="sparkles-outline" size={34} color={colors.accent} />
            </View>
          )}

          <View style={styles.heroOverlay}>
            <Text style={styles.heroLabel}>{isCompleted ? 'A trip worth remembering' : 'One last step'}</Text>
            <Text style={styles.heroTitle}>{currentTrip?.name ?? destination?.name ?? 'Your Trip'}</Text>
            <Text style={styles.heroMeta}>{tripMeta}</Text>
          </View>
        </AppCard>

        {showMemoryCard ? (
          <AppCard style={styles.memoryCard}>
            <View style={styles.memoryHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Memory photo</Text>
                <Text style={styles.memoryTitle}>{primaryPhoto ? 'Memory photo selected' : 'Add one photo'}</Text>
              </View>
              {primaryPhoto ? <Ionicons name="image-outline" size={20} color={colors.accent} /> : null}
            </View>

            {primaryPhoto ? (
              <View style={styles.selectedPhotoRow}>
                <Image
                  source={{
                    uri: `${API_BASE_URL}/api/trips/${currentTrip?.id}/photos/${primaryPhoto.id}/file`,
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  }}
                  style={styles.selectedPhotoThumb}
                />
                <View style={styles.selectedPhotoCopy}>
                  <Text style={styles.selectedPhotoTitle}>Memory photo selected</Text>
                  <Text style={styles.selectedPhotoSubtitle}>This photo will be saved when you finish the trip.</Text>
                </View>
              </View>
            ) : (
              <Pressable style={styles.photoUploadCard} onPress={handleUploadPhoto} disabled={uploading}>
                <View style={styles.uploadIconCircle}>
                  <Ionicons name="image-outline" size={22} color={colors.accent} />
                </View>
                <Text style={styles.photoTitle}>{uploading ? 'Uploading photo...' : 'Add one photo'}</Text>
                <Text style={styles.photoSubtitle}>Choose a memory to close this trip.</Text>
              </Pressable>
            )}

            {primaryPhoto ? (
              <View style={styles.photoActionsRow}>
                <Pressable style={styles.photoActionButton} onPress={handleUploadPhoto} disabled={uploading}>
                  <Ionicons name="swap-horizontal-outline" size={16} color={colors.accent} />
                  <Text style={styles.photoActionText}>{uploading ? 'Replacing...' : 'Replace'}</Text>
                </Pressable>
                <Pressable style={styles.photoRemoveButton} onPress={handleRemovePhoto} disabled={removingPhoto}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={styles.photoRemoveText}>{removingPhoto ? 'Removing...' : 'Remove'}</Text>
                </Pressable>
              </View>
            ) : null}
          </AppCard>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard value={String(members.length)} label="Crew" icon="people-outline" />
          <StatCard value={`${completedEventCount}/${totalEventCount}`} label="Events" icon="checkmark-circle-outline" />
          <StatCard value={`$${tripSpendTotal.toFixed(0)}`} label="Spend" icon="wallet-outline" />
        </View>

        <AppCard>
          <Text style={styles.sectionEyebrow}>Trip details</Text>
          <SummaryRow label="Destination" value={currentTrip?.destination || destination?.name || 'Pending'} />
          <SummaryRow label="Dates" value={tripDates} />
          <SummaryRow label="Trip lead" value={tripLead?.name || members[0]?.name || 'Pending'} />
          <SummaryRow label="Expenses logged" value={`${allExpenses.length}`} />
          <SummaryRow label="Total spend" value={`$${tripSpendTotal.toFixed(2)}`} isLast />
        </AppCard>

        <View style={styles.actions}>
          {canCompleteTrip && !isCompleted ? (
            <PrimaryButton
              title={primaryPhoto ? (completing ? 'Finishing trip...' : 'Finish Trip') : 'Add Photo to Finish'}
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

function StatCard({ value, label, icon }: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SummaryRow({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.summaryRow, isLast && styles.summaryRowLast]}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: footerScrollPadding,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerEyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  headerTitle: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroCard: {
    padding: 0,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#E5E7EB',
  },
  heroImagePlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  heroOverlay: {
    padding: 16,
  },
  heroLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  heroMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  memoryCard: {
    gap: spacing.md,
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  memoryTitle: {
    marginTop: 6,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  photoUploadCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  uploadIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.sm,
  },
  photoTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  photoSubtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  selectedPhotoWrap: {
    display: 'none',
  },
  selectedPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
  },
  selectedPhotoThumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  selectedPhotoCopy: {
    flex: 1,
  },
  selectedPhotoTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedPhotoSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoActionText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  photoRemoveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#F9D1CC',
    backgroundColor: '#FFF1F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoRemoveText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 82,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },
  summaryRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryRowLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  summaryRowValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  actions: {
    gap: spacing.sm,
  },
});
