import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fetchTripLiveLocations, updateTripLocation, userProfileImageFileUrl } from '../config/api';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Live'>,
  NativeStackScreenProps<RootStackParamList>
>;

type LiveMember = {
  user_id: number;
  name: string;
  email: string;
  profile_image_url: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  updated_at: string;
  is_current_user: boolean;
};

const defaultRegion = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function LiveScreen() {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const token = useAuthStore((state) => state.token);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [locations, setLocations] = useState<LiveMember[]>([]);

  const refreshLiveMap = useCallback(async () => {
    if (!currentTrip?.id) {
      setLocations([]);
      return;
    }

    try {
      setLoading(true);

      const permission = await Location.requestForegroundPermissionsAsync();
      const granted = permission.status === 'granted';
      setPermissionGranted(granted);

      if (granted) {
        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        await updateTripLocation(currentTrip.id, {
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy ?? 0,
        });
      }

      const response = await fetchTripLiveLocations(currentTrip.id);
      setLocations(response.locations);
    } catch (error) {
      console.log('Live map refresh failed', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id]);

  useEffect(() => {
    refreshLiveMap();
  }, [refreshLiveMap]);

  useFocusEffect(
    useCallback(() => {
      refreshLiveMap();
    }, [refreshLiveMap])
  );

  const mappableLocations = useMemo(
    () => locations.filter((item) => item.latitude !== null && item.longitude !== null),
    [locations]
  );

  const region = useMemo(() => {
    const firstLocation = mappableLocations[0];
    if (!firstLocation || firstLocation.latitude === null || firstLocation.longitude === null) {
      return defaultRegion;
    }

    return {
      latitude: firstLocation.latitude,
      longitude: firstLocation.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [mappableLocations]);

  return (
    <Screen>
      <SectionTitle title="Live" subtitle="Track the trip crew on a real map with current locations." />

      {!currentTrip ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No active trip selected</Text>
          <Text style={styles.emptyText}>Open a trip first to see live member locations.</Text>
        </AppCard>
      ) : (
        <>
          <View style={styles.mapWrap}>
            {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}

            {!loading && mappableLocations.length > 0 ? (
              <MapView style={styles.map} initialRegion={region} region={region}>
                {mappableLocations.map((member, index) => (
                  <Marker
                    key={member.user_id}
                    coordinate={jitterCoordinate(member, index)}
                    title={member.name || member.email}
                    description={member.is_current_user ? 'You' : member.updated_at}
                  >
                    <View style={[styles.avatarMarker, member.is_current_user && styles.avatarMarkerSelf]}>
                      {member.profile_image_url && token ? (
                        <Image
                          source={{
                            uri: userProfileImageFileUrl(member.user_id),
                            headers: { Authorization: `Bearer ${token}` },
                          }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <Text style={styles.avatarText}>{(member.name || member.email || 'U').slice(0, 1).toUpperCase()}</Text>
                      )}
                    </View>
                  </Marker>
                ))}
              </MapView>
            ) : !loading ? (
              <View style={styles.mapFallback}>
                <Text style={styles.mapText}>
                  {permissionGranted
                    ? 'No live locations shared yet.'
                    : 'Location permission is required for the live map.'}
                </Text>
              </View>
            ) : null}
          </View>

          <AppCard>
            <Text style={styles.sectionLabel}>Crew status</Text>
            {locations.length === 0 ? (
              <Text style={styles.emptyText}>No crew locations are available yet.</Text>
            ) : (
              locations.map((member) => (
                <View key={member.user_id} style={styles.memberRow}>
                  <View>
                    <Text style={styles.memberName}>{member.name || member.email}</Text>
                    <Text style={styles.memberMeta}>
                      {member.latitude !== null && member.longitude !== null
                        ? `Updated ${member.updated_at}`
                        : 'Location pending'}
                    </Text>
                  </View>
                  <Text style={styles.memberBadge}>{member.is_current_user ? 'You' : 'Crew'}</Text>
                </View>
              ))
            )}
          </AppCard>

          <PrimaryButton title="Refresh live map" onPress={refreshLiveMap} />
        </>
      )}
    </Screen>
  );
}

function jitterCoordinate(member: LiveMember, index: number) {
  const latitude = member.latitude ?? 0;
  const longitude = member.longitude ?? 0;
  const offset = index * 0.00012;
  return {
    latitude: latitude + offset,
    longitude: longitude + offset,
  };
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 300,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#DCE7F9',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
  },
  avatarMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarMarkerSelf: {
    borderColor: colors.success,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.accent,
    fontWeight: '800',
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  mapText: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionLabel: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  memberBadge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
