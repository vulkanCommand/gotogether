import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { syncDeviceContacts } from '../config/api';
import { useFriendStore } from '../store/friendStore';
import { collectDeviceContactLookupPayload } from '../utils/contacts';

type PermissionStatus = 'idle' | 'granted' | 'denied';
type Props = NativeStackScreenProps<RootStackParamList, 'PermissionsSetup'>;

export default function PermissionsSetupScreen({ navigation }: Props) {
  const setFriends = useFriendStore((state) => state.setFriends);

  const [contactsStatus, setContactsStatus] = useState<PermissionStatus>('idle');
  const [locationStatus, setLocationStatus] = useState<PermissionStatus>('idle');
  const [mediaStatus, setMediaStatus] = useState<PermissionStatus>('idle');
  const [loading, setLoading] = useState(false);

  const requestAllPermissions = async () => {
    try {
      setLoading(true);

      const contacts = await collectDeviceContactLookupPayload();
      const contactsGranted = contacts.granted;
      setContactsStatus(contactsGranted ? 'granted' : 'denied');
      if (contactsGranted) {
        const response = await syncDeviceContacts({
          emails: contacts.emails,
          phones: contacts.phones,
        });
        setFriends(response.friends);
      }

      const location = await Location.requestForegroundPermissionsAsync();
      const locationGranted = location.status === 'granted';
      setLocationStatus(locationGranted ? 'granted' : 'denied');

      const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const mediaGranted = media.status === 'granted';
      setMediaStatus(mediaGranted ? 'granted' : 'denied');

      // Ensure all permissions are granted; otherwise force the user back to onboarding
      if (contactsGranted && locationGranted && mediaGranted) {
        navigation.replace('MainTabs');
      } else {
        Alert.alert(
          'Permissions required',
          'All permissions are required to use the app. Please grant all permissions to continue.',
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('Onboarding'),
            },
          ]
        );
      }
    } catch (error: any) {
      console.log('Permission setup failed', error);
      Alert.alert('Permission setup failed', error?.message || 'Could not complete setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <SectionTitle
        title="Allow permissions"
        subtitle="Contacts power friend discovery, location powers the live map, and media powers trip photos."
      />

      <AppCard>
        <PermissionRow label="Contacts" status={contactsStatus} />
        <PermissionRow label="Location" status={locationStatus} />
        <PermissionRow label="Media library" status={mediaStatus} isLast />
      </AppCard>

      <PrimaryButton
        title={loading ? 'Requesting permissions...' : 'Allow and continue'}
        onPress={requestAllPermissions}
      />
    </Screen>
  );
}

function PermissionRow({
  label,
  status,
  isLast = false,
}: {
  label: string;
  status: PermissionStatus;
  isLast?: boolean;
}) {
  const statusLabel =
    status === 'granted' ? 'Granted' : status === 'denied' ? 'Denied' : 'Pending';

  return (
    <View style={[styles.permissionRow, isLast && styles.permissionRowLast]}>
      <Text style={styles.permissionLabel}>{label}</Text>
      <View style={[styles.statusPill, status === 'granted' && styles.statusPillGranted]}>
        <Text style={[styles.statusText, status === 'granted' && styles.statusTextGranted]}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    paddingVertical: spacing.md,
  },
  permissionRowLast: {
    borderBottomWidth: 0,
  },
  permissionLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: radius.pill,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusPillGranted: {
    backgroundColor: '#ECFDF5',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextGranted: {
    color: colors.success,
  },
});
