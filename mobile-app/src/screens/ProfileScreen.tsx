import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GTCard from '../components/GTCard';
import GTSectionHeader from '../components/GTSectionHeader';
import TextField from '../components/TextField';
import NotificationBell from '../components/NotificationBell';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { footerScrollPadding, radius, spacing } from '../theme/spacing';
import {
  deleteMyProfileImage,
  fetchExpenseGroups,
  fetchTrips,
  ApiTrip,
  profileImageFileUrl,
  updateMyProfile,
  updateMyProfileImage,
} from '../config/api';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import { calculateOverallExpenseSummary, formatMoney, getBalanceDisplay } from '../utils/expenseCalculations';
import { cacheKeys, readCachedValue, writeCachedValue } from '../services/resourceCache';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const friends = useFriendStore((state) => state.friends);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [totalTripsCount, setTotalTripsCount] = useState<number | null>(null);
  const [expenseSummaryLabel, setExpenseSummaryLabel] = useState('No expense activity yet');
  const [saving, setSaving] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const [photoActionsVisible, setPhotoActionsVisible] = useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.name, user?.phone]);

  useEffect(() => {
    const loadTripCount = async () => {
      try {
        const cachedTrips = await readCachedValue<ApiTrip[]>(cacheKeys.trips);

        if (cachedTrips?.value) {
          setTotalTripsCount(cachedTrips.value.length);
        }

        const response = await fetchTrips();
        const trips = Array.isArray(response.trips) ? response.trips : [];
        await writeCachedValue(cacheKeys.trips, trips);
        setTotalTripsCount(trips.length);

        if (trips.length > 0 && user?.id) {
          const groups = (
            await Promise.all(trips.map(async (trip) => (await fetchExpenseGroups(trip.id)).groups ?? []))
          ).flat();
          const summary = calculateOverallExpenseSummary(groups, [], user.id);
          const display = getBalanceDisplay(summary.netBalance);
          setExpenseSummaryLabel(
            display.isSettled ? 'Settled up across your trips' : `${display.label} ${formatMoney(display.amount)}`
          );
        } else {
          setExpenseSummaryLabel('No expense activity yet');
        }
      } catch (error) {
        console.log('Profile trip count load failed', error);
        setTotalTripsCount(0);
        setExpenseSummaryLabel('No expense activity yet');
      }
    };

    void loadTripCount();
  }, [user?.id]);

  const displayName = user?.name?.trim() || user?.username?.trim() || 'Traveler';
  const displayPhone = user?.phone?.trim() || 'Phone not set';
  const totalTripsLabel = `${totalTripsCount ?? 0} total trip${(totalTripsCount ?? 0) === 1 ? '' : 's'}`;
  const connectedFriendsLabel = `${friends.length} connected friend${friends.length === 1 ? '' : 's'}`;

  const avatarSource =
    user?.profile_image_url && token
      ? {
          uri: `${profileImageFileUrl()}?cb=${avatarVersion}`,
          headers: { Authorization: `Bearer ${token}` },
        }
      : null;

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter your name.');
      return;
    }

    try {
      setSaving(true);

      const response = await updateMyProfile({
        name: name.trim(),
        username: user?.username?.trim() || name.trim().replace(/\s+/g, '').toLowerCase(),
        phone: phone.trim(),
        home_city: user?.home_city ?? '',
        bio: user?.bio ?? '',
      });

      setUser(response.user);
      setEditing(false);
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const pickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert('Photos permission needed', 'Allow photo access to update your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    try {
      const asset = result.assets[0];

      const response = await updateMyProfileImage({
        photo: {
          uri: asset.uri,
          name: asset.fileName || 'profile.jpg',
          type: asset.mimeType || 'image/jpeg',
        },
      });

      setUser(response.user);
      setAvatarVersion(Date.now());
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not update profile picture');
    }
  };

  const removeProfileImage = async () => {
    try {
      const response = await deleteMyProfileImage();
      setUser(response.user);
      setAvatarVersion(Date.now());
    } catch (error: any) {
      Alert.alert('Remove failed', error?.message || 'Could not remove profile picture');
    }
  };

  const openPhotoActions = () => {
    setPhotoActionsVisible(true);
  };

  const openPhotoPreview = () => {
    if (!avatarSource) {
      return;
    }

    setPhotoActionsVisible(false);
    setPhotoPreviewVisible(true);
  };

  const handleChangePhoto = () => {
    setPhotoActionsVisible(false);
    void pickProfileImage();
  };

  const handleRemovePhoto = () => {
    setPhotoActionsVisible(false);
    Alert.alert('Remove photo', 'Remove your current profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeProfileImage(),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 22) + 12 }]}
      >
        <View style={styles.topRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Your travel identity and trip stats.</Text>
          </View>

          <View style={styles.headerActions}>
            <NotificationBell />
            <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <GTCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Pressable style={styles.avatarWrap} onPress={openPhotoActions}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={13} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={styles.identity}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.phone}>{displayPhone}</Text>

              <View style={styles.metricGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{friends.length}</Text>
                  <Text style={styles.metricLabel}>Friends</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{totalTripsCount ?? 0}</Text>
                  <Text style={styles.metricLabel}>Trips</Text>
                </View>
              </View>
            </View>
          </View>
        </GTCard>

        <GTCard style={styles.expenseSummaryCard}>
          <Text style={styles.cardTitle}>Money snapshot</Text>
          <Text style={styles.expenseSummaryText}>{expenseSummaryLabel}</Text>
          <Pressable style={styles.expenseSummaryLink} onPress={() => navigation.navigate('MainTabs', { screen: 'Expenses' })}>
            <Text style={styles.expenseSummaryLinkText}>Open Expenses</Text>
          </Pressable>
        </GTCard>

        <GTCard style={styles.detailsCard}>
          <GTSectionHeader
            title="Details"
            subtitle="Only the essentials."
            actionLabel={editing ? 'Cancel' : 'Edit'}
            onPressAction={() => setEditing((value) => !value)}
          />

          {editing ? (
            <>
              <TextField label="Name" placeholder="Your name" value={name} onChangeText={setName} />
              <TextField label="Phone number" placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

              <Pressable style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} onPress={saveProfile} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <DetailRow icon="person-outline" label="Name" value={displayName} />
              <DetailRow icon="call-outline" label="Phone number" value={displayPhone} />
            </>
          )}
        </GTCard>
      </ScrollView>

      <Modal transparent visible={photoActionsVisible} animationType="fade" onRequestClose={() => setPhotoActionsVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPhotoActionsVisible(false)}>
          <View style={styles.modalCenter}>
            <Pressable style={styles.actionModalCard} onPress={() => undefined}>
              {avatarSource ? (
                <Pressable style={styles.actionRow} onPress={openPhotoPreview}>
                  <Text style={styles.actionRowPrimaryText}>View profile photo</Text>
                </Pressable>
              ) : null}

              <Pressable style={styles.actionRow} onPress={handleChangePhoto}>
                <Text style={styles.actionRowPrimaryText}>Change photo</Text>
              </Pressable>

              {avatarSource ? (
                <Pressable style={styles.actionRow} onPress={handleRemovePhoto}>
                  <Text style={styles.actionRowDangerText}>Remove photo</Text>
                </Pressable>
              ) : null}

              <Pressable style={[styles.actionRow, styles.actionRowLast]} onPress={() => setPhotoActionsVisible(false)}>
                <Text style={styles.actionRowCancelText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={photoPreviewVisible} animationType="fade" onRequestClose={() => setPhotoPreviewVisible(false)}>
        <View style={styles.previewBackdrop}>
          <Pressable style={styles.previewCloseButton} onPress={() => setPhotoPreviewVisible(false)}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.previewContent}>
            {avatarSource ? <Image source={avatarSource} style={styles.previewImage} resizeMode="contain" /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={colors.accentStrong} />
      </View>

      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
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
    paddingBottom: footerScrollPadding,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowColor: colors.shadowStrong,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  heroCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.accentStrong,
  },
  cameraBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  identity: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  phone: {
    marginTop: 5,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  metricLabel: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailsCard: {
    padding: 18,
  },
  expenseSummaryCard: {
    minHeight: 92,
    gap: 6,
    justifyContent: 'space-between',
  },
  expenseSummaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  expenseSummaryLink: {
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  expenseSummaryLinkText: {
    color: colors.accentStrong,
    fontSize: 14,
    fontWeight: '600',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.accentStrong,
    fontWeight: '600',
    fontSize: 13,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  detailIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 23,
  },
  primaryButton: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCenter: {
    justifyContent: 'center',
  },
  actionModalCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionRowPrimaryText: {
    color: colors.accentStrong,
    fontSize: 16,
    fontWeight: '600',
  },
  actionRowDangerText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  actionRowCancelText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  previewCloseButton: {
    position: 'absolute',
    top: 54,
    right: 24,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  previewContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: 360,
    borderRadius: radius.xl,
  },
});
