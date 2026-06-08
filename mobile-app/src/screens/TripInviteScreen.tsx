import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/AppNavigator';
import { acceptTripInvite, fetchTripDetails } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { mapApiMembersToCrew } from '../utils/tripFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'TripInvite'>;

export default function TripInviteScreen({ navigation, route }: Props) {
  const token = route.params?.token || '';
  const authToken = useAuthStore((state) => state.token);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);

  const [accepting, setAccepting] = useState(false);

  const acceptInvite = useCallback(async () => {
    if (!authToken) {
      Alert.alert('Sign in needed', 'Log in first, then open the invite link again to join the trip.');
      navigation.navigate('Login');
      return;
    }
    if (!token) {
      Alert.alert('Invite unavailable', 'This invite link is missing its code.');
      return;
    }

    try {
      setAccepting(true);
      const accepted = await acceptTripInvite(token);
      const details = await fetchTripDetails(accepted.trip_id);
      const nextCrew = mapApiMembersToCrew(details.members);

      setCurrentTrip(details.trip);
      setCrew(nextCrew);
      setTripLead(nextCrew.find((member) => member.role === 'lead') ?? nextCrew[0] ?? null);
      navigation.reset({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'TripOverview' }],
      });
    } catch (error: any) {
      Alert.alert('Invite failed', error?.message || 'Could not join this trip right now.');
    } finally {
      setAccepting(false);
    }
  }, [authToken, navigation, setCrew, setCurrentTrip, setTripLead, token]);

  useEffect(() => {
    if (authToken && token) {
      void acceptInvite();
    }
  }, [acceptInvite, authToken, token]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          {accepting ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Ionicons name="people-outline" size={30} color={colors.accent} />
          )}
        </View>
        <Text style={styles.title}>Join Trip</Text>
        <Text style={styles.copy}>
          {authToken
            ? accepting
              ? 'Adding you to the trip...'
              : 'Tap below to join this trip.'
            : 'Log in to GoTogether, then open this invite again.'}
        </Text>
        <Pressable style={styles.primaryButton} onPress={acceptInvite} disabled={accepting}>
          <Text style={styles.primaryButtonText}>{authToken ? 'Join Trip' : 'Log In'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  copy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
