import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
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
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Profile"
          subtitle="Your travel identity and connected friends."
          action={
            <View style={styles.headerActions}>
              <NotificationBell />
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
                <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
          }
        />

        <AppCard>
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
              <Text style={styles.email}>{user?.email || 'Signed in user'}</Text>
              <Text style={styles.stat}>{friends.length} connected friends</Text>
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
        </AppCard>

        <AppCard>
          <View style={styles.detailHeader}>
            <Text style={styles.cardTitle}>Details</Text>
            <Pressable onPress={() => setEditing((value) => !value)}>
              <Text style={styles.editLink}>{editing ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          </View>

          {editing ? (
            <>
              <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Username" placeholderTextColor={colors.textSecondary} value={username} onChangeText={setUsername} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={colors.textSecondary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <TextInput style={styles.input} placeholder="Home city" placeholderTextColor={colors.textSecondary} value={homeCity} onChangeText={setHomeCity} />
              <TextInput style={[styles.input, styles.bioInput]} placeholder="Short bio" placeholderTextColor={colors.textSecondary} value={bio} onChangeText={setBio} multiline />
              <PrimaryButton title={saving ? 'Saving...' : 'Save profile'} onPress={saveProfile} />
            </>
          ) : (
            <>
              <DetailRow label="Username" value={user?.username || 'Not set'} />
              <DetailRow label="Phone" value={user?.phone || 'Not set'} />
              <DetailRow label="Home city" value={user?.home_city || 'Not set'} />
              <DetailRow label="Bio" value={user?.bio || 'No bio added yet.'} />
            </>
          )}
        </AppCard>
      </ScrollView>
    </Screen>
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
  content: {
    paddingBottom: spacing.xl,
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
    width: 82,
    height: 82,
    borderRadius: 41,
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
    fontSize: 30,
    fontWeight: '800',
    color: colors.accent,
  },
  identity: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  email: {
    marginTop: 4,
    color: colors.textSecondary,
  },
  stat: {
    marginTop: 6,
    color: colors.accent,
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  editLink: {
    color: colors.accent,
    fontWeight: '800',
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
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  bioInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
