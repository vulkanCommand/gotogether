import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiRequest, fetchTripLiveLocations, updateTripLocation, userProfileImageFileUrl } from '../config/api';
import { isCompletedEvent, useTripStore } from '../store/tripStore';
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

const nativeMaps = Platform.OS === 'web' ? null : require('react-native-maps');
const MapView = nativeMaps?.default as any;
const Marker = nativeMaps?.Marker as any;
const Polyline = nativeMaps?.Polyline as any;

const defaultRegion = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const openMapsLocation = async (value?: string) => {
  const query = value?.trim();
  if (!query) {
    return;
  }
  try {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  } catch {
    Alert.alert('Maps unavailable', 'Could not open this location in Maps.');
  }
};

const shouldShowLocationIcon = (location?: string, locationIsMapped?: boolean) => {
  const normalized = location?.trim() ?? '';
  if (!normalized || normalized.toLowerCase() === 'location tbd') {
    return false;
  }
  return Boolean(locationIsMapped || normalized.includes(','));
};

export default function LiveScreen() {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const setItineraryDays = useTripStore((state) => state.setItineraryDays);
  const token = useAuthStore((state) => state.token);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [locations, setLocations] = useState<LiveMember[]>([]);
  const [destinationCoordinate, setDestinationCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationStatus, setDestinationStatus] = useState('');

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
      const itinerary = await apiRequest<{ days: typeof itineraryDays }>(`/api/trips/${currentTrip.id}/itinerary`);
      setItineraryDays(Array.isArray(itinerary.days) ? itinerary.days : []);
    } catch (error) {
      console.log('Live map refresh failed', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id, setItineraryDays]);

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

  const activeDestination = useMemo(() => {
    for (const day of itineraryDays) {
      const activeEvent = day.events.find((event) => !isCompletedEvent(event) && event.status === 'active');
      if (activeEvent?.location) {
        return { dayTitle: day.title, event: activeEvent };
      }
      const upcomingEvent = day.events.find((event) => !isCompletedEvent(event) && event.status === 'upcoming');
      if (upcomingEvent?.location) {
        return { dayTitle: day.title, event: upcomingEvent };
      }
    }
    return null;
  }, [itineraryDays]);

  useEffect(() => {
    let cancelled = false;

    const geocodeDestination = async () => {
      const locationText = activeDestination?.event.location?.trim();
      if (!locationText) {
        setDestinationCoordinate(null);
        setDestinationStatus('No active event location yet.');
        return;
      }

      try {
        setDestinationStatus('Finding event destination...');
        const results = await Location.geocodeAsync(locationText);
        if (cancelled) {
          return;
        }
        const first = results[0];
        if (first) {
          setDestinationCoordinate({ latitude: first.latitude, longitude: first.longitude });
          setDestinationStatus('');
        } else {
          setDestinationCoordinate(null);
          setDestinationStatus('Could not map this event location yet.');
        }
      } catch {
        if (!cancelled) {
          setDestinationCoordinate(null);
          setDestinationStatus('Could not map this event location yet.');
        }
      }
    };

    geocodeDestination();
    return () => {
      cancelled = true;
    };
  }, [activeDestination?.event.location]);

  const region = useMemo(() => {
    if (destinationCoordinate) {
      return {
        latitude: destinationCoordinate.latitude,
        longitude: destinationCoordinate.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

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
  }, [destinationCoordinate, mappableLocations]);

  const hasMapPins = mappableLocations.length > 0 || destinationCoordinate !== null;
  const selfLocation = mappableLocations.find((member) => member.is_current_user);
  const selfDistance = selfLocation && destinationCoordinate ? distanceMiles(selfLocation, destinationCoordinate) : null;

  return (
    <Screen>
      <SectionTitle title="Live" subtitle="Track the trip crew on a real map with current locations." action={<NotificationBell />} />

      {!currentTrip ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No active trip selected</Text>
          <Text style={styles.emptyText}>Open a trip first to see live member locations.</Text>
        </AppCard>
      ) : (
        <>
          <View style={styles.mapWrap}>
            {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}

            {!loading && hasMapPins && Platform.OS !== 'web' ? (
              <MapView style={styles.map} initialRegion={region} region={region}>
                {destinationCoordinate ? (
                  <Marker
                    coordinate={destinationCoordinate}
                    title={activeDestination?.event.title || 'Active destination'}
                    description={activeDestination?.event.location}
                    pinColor="#2563EB"
                  />
                ) : null}
                {destinationCoordinate
                  ? mappableLocations.map((member, index) => (
                      <Polyline
                        key={`route-${member.user_id}`}
                        coordinates={[jitterCoordinate(member, index), destinationCoordinate]}
                        strokeColor={member.is_current_user ? colors.success : colors.accent}
                        strokeWidth={member.is_current_user ? 4 : 2}
                        lineDashPattern={member.is_current_user ? undefined : [8, 6]}
                      />
                    ))
                  : null}
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
                  {Platform.OS === 'web'
                    ? 'Live map preview is available on the mobile app.'
                    : permissionGranted
                    ? 'No live locations shared yet.'
                    : 'Location permission is required for the live map.'}
                </Text>
              </View>
            ) : null}
          </View>

          <AppCard>
            <Text style={styles.sectionLabel}>Active destination</Text>
            {activeDestination ? (
              <>
                <Text style={styles.destinationTitle}>{activeDestination.event.title}</Text>
                <Text style={styles.destinationMeta}>
                  {activeDestination.dayTitle} - {activeDestination.event.time}
                </Text>
                {shouldShowLocationIcon(activeDestination.event.location, activeDestination.event.locationIsMapped) ? (
                  <Pressable
                    style={styles.locationIcon}
                    onPress={() => openMapsLocation(activeDestination.event.location)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${activeDestination.event.location} in Maps`}
                  >
                    <Ionicons name="location" size={22} color={colors.accent} />
                  </Pressable>
                ) : (
                  <Text style={styles.destinationMeta}>{activeDestination.event.location}</Text>
                )}
                <Text style={styles.distanceText}>
                  {selfDistance !== null ? `${formatMiles(selfDistance)} from you` : destinationStatus || 'Share your location to see your distance.'}
                </Text>
              </>
            ) : (
              <Text style={styles.emptyText}>Add an itinerary event location to show the live destination.</Text>
            )}
          </AppCard>

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
                        ? `Updated ${member.updated_at}${destinationCoordinate ? ` - ${formatMiles(distanceMiles(member, destinationCoordinate))} away` : ''}`
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

function distanceMiles(
  from: { latitude: number | null; longitude: number | null },
  to: { latitude: number; longitude: number }
) {
  if (from.latitude === null || from.longitude === null) {
    return 0;
  }
  const earthMiles = 3958.8;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function formatMiles(value: number) {
  if (value < 0.1) {
    return 'less than 0.1 mi';
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} mi`;
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 470,
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
  destinationTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  destinationMeta: {
    marginTop: 5,
    color: colors.textSecondary,
  },
  locationIcon: {
    marginTop: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceText: {
    marginTop: spacing.sm,
    color: colors.accent,
    fontWeight: '900',
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
