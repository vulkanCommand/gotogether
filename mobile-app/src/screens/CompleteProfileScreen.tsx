import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import Pill from '../components/Pill';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import TextField from '../components/TextField';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { updateMyProfile, updateMyProfileImage } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { formatPhoneForDisplay } from '../utils/phone';
import { TEXT_SAFETY_ERROR_MESSAGE, validateUserText } from '../utils/textSafety';

type Props = NativeStackScreenProps<RootStackParamList, 'CompleteProfile'>;

export default function CompleteProfileScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [name, setName] = useState(user?.name ?? '');
  const [profilePhoto, setProfilePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const pickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Photos permission needed', 'Allow photo access to add a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePhoto(result.assets[0]);
    }
  };

  const handleSave = async () => {
    const nameValidation = validateUserText(name, { required: true, maxLength: 60 });

    if (nameValidation.reason === 'required') {
      Alert.alert('Missing details', 'Your name is required.');
      return;
    }
    if (!nameValidation.ok) {
      Alert.alert('Edit text', TEXT_SAFETY_ERROR_MESSAGE);
      return;
    }

    try {
      setSaving(true);
      const response = await updateMyProfile({
        name: nameValidation.value,
        phone: user?.phone ?? '',
      });
      let updatedUser = response.user;
      if (profilePhoto) {
        const imageResponse = await updateMyProfileImage({
          photo: {
            uri: profilePhoto.uri,
            name: profilePhoto.fileName || 'profile.jpg',
            type: profilePhoto.mimeType || 'image/jpeg',
          },
        });
        updatedUser = imageResponse.user;
      }
      setUser(updatedUser);
      navigation.replace('MainTabs');
    } catch (error: any) {
      console.log('Profile update failed', error);
      Alert.alert('Save failed', error?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Finish sign up"
          subtitle="Add your name and a profile photo so your trip crew knows it is you."
        />

        <AppCard>
          <Pill label="Verified phone number" tone="accent" />
          <Text style={styles.phoneLabel}>{formatPhoneForDisplay(user?.phone || '') || 'Verified phone number'}</Text>

          <Pressable style={styles.avatarWrap} onPress={pickProfileImage}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto.uri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>Add profile photo</Text>
            )}
          </Pressable>

          <TextField
            label="Full name"
            placeholder="Full name"
            value={name}
            onChangeText={setName}
          />
        </AppCard>

        <PrimaryButton
          title={saving ? 'Saving profile...' : 'Continue'}
          onPress={handleSave}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  phoneLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  avatarWrap: {
    height: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.accent,
    fontWeight: '600',
  },
});
