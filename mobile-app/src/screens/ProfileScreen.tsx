import React, { useState } from 'react';
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
import { deleteMyProfileImage, profileImageFileUrl, updateMyProfile, updateMyProfileImage } from '../config/api';
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
  const [username, setUsername] = useState(user?.username ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [homeCity, setHomeCity] = useState(user?.home_city ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    if (!name.trim() || !username.trim()) {
      Alert.alert('Missing details', 'Name and username are required.');
      return;
    }

    try {
      setSaving(true);
      const response = await updateMyProfile({
        name: name.trim(),
        username: username.trim(),
        phone: phone.trim(),
        home_city: homeCity.trim(),
        bio: bio.trim(),
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
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not update profile picture');
    }
  };

  const removeProfileImage = async () => {
    try {
      const response = await deleteMyProfileImage();
      setUser(response.user);
    } catch (error: any) {
      Alert.alert('Remove failed', error?.message || 'Could not remove profile picture');
    }
  };

  const avatarSource =
    user?.profile_image_url && token
      ? { uri: profileImageFileUrl(), headers: { Authorization: `Bearer ${token}` } }
      : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 22) + 12 }]}
      >
        <View style={styles.topRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Travel profile and friends.</Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
            <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable style={styles.avatarWrap} onPress={pickProfileImage}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</Text>
              )}
            </Pressable>

            <View style={styles.identity}>
              <Text style={styles.name}>{user?.name || 'Your name'}</Text>
              <Text style={styles.email}>{user?.email || user?.phone || 'Signed in user'}</Text>
              <View style={styles.statRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statPillText}>{friends.length} connected friends</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statPillText}>{user?.username ? `@${user.username}` : 'Profile ready'}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.imageActions}>
            <Pressable style={styles.smallButton} onPress={pickProfileImage}>
              <Text style={styles.smallButtonText}>{avatarSource ? 'Change photo' : 'Upload photo'}</Text>
            </Pressable>
            {avatarSource ? (
              <Pressable style={styles.smallButton} onPress={removeProfileImage}>
                <Text style={styles.smallButtonText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.detailHeader}>
            <Text style={styles.cardTitle}>Details</Text>
            <Pressable onPress={() => setEditing((value) => !value)}>
              <Text style={styles.editLink}>{editing ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          </View>

          {editing ? (
            <>
              <TextField label="Full name" placeholder="Full name" value={name} onChangeText={setName} />
              <TextField label="Username" placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
              <TextField label="Phone number" placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <TextField label="Home city" placeholder="Home city" value={homeCity} onChangeText={setHomeCity} />
              <TextField label="Short bio" placeholder="Short bio" value={bio} onChangeText={setBio} multiline />
              <Pressable style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} onPress={saveProfile} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save profile'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <DetailRow label="Username" value={user?.username || 'Not set'} />
              <DetailRow label="Phone" value={user?.phone || 'Not set'} />
              <DetailRow label="Home city" value={user?.home_city || 'Not set'} />
              <DetailRow label="Bio" value={user?.bio || 'No bio added yet.'} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    fontSize: 30,
    fontWeight: '900',
  },
  headerSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
  },
  card: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
  },
  identity: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  email: {
    marginTop: 4,
    color: colors.textSecondary,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statPillText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  imageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallButtonText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editLink: {
    color: colors.accent,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 21,
  },
});
