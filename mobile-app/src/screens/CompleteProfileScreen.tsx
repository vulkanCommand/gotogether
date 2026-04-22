import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { updateMyProfile } from '../config/api';
import { useAuthStore } from '../store/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'CompleteProfile'>;

export default function CompleteProfileScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [homeCity, setHomeCity] = useState(user?.home_city ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
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
      navigation.replace('PermissionsSetup');
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
          title="Finish your profile"
          subtitle="A few basics make the rest of the app personal and easier to use."
        />

        <AppCard>
          <Text style={styles.emailLabel}>{user?.email || 'Signed in account'}</Text>

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor={colors.textSecondary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Home city"
            placeholderTextColor={colors.textSecondary}
            value={homeCity}
            onChangeText={setHomeCity}
          />

          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Short bio"
            placeholderTextColor={colors.textSecondary}
            value={bio}
            onChangeText={setBio}
            multiline
          />
        </AppCard>

        <PrimaryButton
          title={saving ? 'Saving profile...' : 'Save and continue'}
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
  emailLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.md,
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
    marginBottom: 0,
  },
});
