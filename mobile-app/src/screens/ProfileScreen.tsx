import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TextField from '../components/TextField';
import NotificationBell from '../components/NotificationBell';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import {
  deleteMyProfileImage,
  fetchTrips,
  profileImageFileUrl,
  updateMyProfile,
  updateMyProfileImage,
} from '../config/api';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';

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
  const [saving, setSaving] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.name, user?.phone]);

  useEffect(() => {
    const loadTripCount = async () => {
      try {
        const response = await fetchTrips();
        const trips = Array.isArray(response.trips) ? response.trips : [];
        setTotalTripsCount(trips.length);
      } catch (error) {
        console.log('Profile trip count load failed', error);
        setTotalTripsCount(0);
      }
    };

    void loadTripCount();
  }, []);

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

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Pressable style={styles.avatarWrap} onPress={pickProfileImage}>
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

          <View style={styles.quickActions}>
            <Pressable style={styles.photoButton} onPress={pickProfileImage}>
              <Ionicons name="image-outline" size={17} color={colors.accentStrong} />
              <Text style={styles.photoButtonText}>{avatarSource ? 'Change photo' : 'Upload photo'}</Text>
            </Pressable>

            {avatarSource ? (
              <Pressable style={styles.removeButton} onPress={removeProfileImage}>
                <Ionicons name="trash-outline" size={17} color={colors.danger} />
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Ionicons name="people-outline" size={16} color={colors.accentStrong} />
            <Text style={styles.summaryPillText}>{connectedFriendsLabel}</Text>
          </View>

          <View style={styles.summaryPill}>
            <Ionicons name="airplane-outline" size={16} color={colors.accentStrong} />
            <Text style={styles.summaryPillText}>{totalTripsLabel}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.cardTitle}>Details</Text>
              <Text style={styles.cardSubtitle}>Only the essentials.</Text>
            </View>

            <Pressable style={styles.editButton} onPress={() => setEditing((value) => !value)}>
              <Ionicons name={editing ? 'close-outline' : 'create-outline'} size={16} color={colors.accentStrong} />
              <Text style={styles.editButtonText}>{editing ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          </View>

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
        </View>
      </ScrollView>
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
    paddingBottom: 120,
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
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
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
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    shadowColor: colors.shadowStrong,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
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
    fontWeight: '900',
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
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  phone: {
    marginTop: 5,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
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
    paddingVertical: 10,
    alignItems: 'center',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  photoButton: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoButtonText: {
    color: colors.accentStrong,
    fontWeight: '900',
    fontSize: 14,
  },
  removeButton: {
    borderRadius: radius.pill,
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#F8C7C7',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  removeButtonText: {
    color: colors.danger,
    fontWeight: '900',
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryPill: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  summaryPillText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  detailsCard: {
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
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
    fontWeight: '900',
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
    fontWeight: '900',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '800',
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
    fontWeight: '900',
  },
});