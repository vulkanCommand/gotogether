import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import { apiRequest, ApiTrip, fetchFriends } from '../config/api';
import { useTripStore } from '../store/tripStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const friends = useFriendStore((state) => state.friends);
  const setFriends = useFriendStore((state) => state.setFriends);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);

  const fetchHomeData = useCallback(async () => {
    try {
      if (!token) {
        setTrips([]);
        return;
      }

      setLoading(true);
      const [tripResponse, friendResponse] = await Promise.all([
        apiRequest<{ trips: ApiTrip[] }>('/api/trips'),
        fetchFriends(),
      ]);

      setTrips(Array.isArray(tripResponse.trips) ? tripResponse.trips : []);
      setFriends(Array.isArray(friendResponse.friends) ? friendResponse.friends : []);
    } catch (err) {
      console.log('Home fetch error', err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [setFriends, token]);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  useFocusEffect(
    useCallback(() => {
      fetchHomeData();
    }, [fetchHomeData])
  );

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Home"
          subtitle={`Welcome ${user?.name || user?.email || 'back'}`}
        />

        <AppCard>
          <Text style={styles.label}>Current trips</Text>

          {trips.length === 0 ? (
            <>
              <Text style={styles.emptyTitle}>No active trips yet</Text>
              <Text style={styles.emptyText}>
                Create a group and start planning your first trip with real data.
              </Text>
            </>
          ) : (
            <View style={styles.tripList}>
              {trips.slice(0, 3).map((trip) => (
                <Pressable
                  key={trip.id}
                  onPress={() => {
                    setCurrentTrip(trip);
                    navigation.navigate('TripOverview');
                  }}
                  style={styles.tripRow}
                >
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripTitle}>{trip.name}</Text>
                    <Text style={styles.meta}>
                      {trip.start_date} - {trip.end_date}
                    </Text>
                    <Text style={styles.meta}>{trip.destination}</Text>
                  </View>

                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{trip.members_count ?? 1} people</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </AppCard>

        <AppCard>
          <View style={styles.friendHeader}>
            <Text style={styles.label}>Friends from contacts</Text>
            <Text style={styles.friendCount}>{friends.length}</Text>
          </View>

          {friends.length === 0 ? (
            <Text style={styles.emptyText}>
              No matched friends yet. Open Profile and re-run permissions if you want to sync contacts again.
            </Text>
          ) : (
            <View style={styles.friendList}>
              {friends.slice(0, 6).map((friend) => (
                <View key={friend.id} style={styles.friendCard}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {(friend.name || friend.email).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.name || friend.email}</Text>
                    <Text style={styles.friendMeta}>{friend.email || friend.username}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </AppCard>

        <PrimaryButton title="Create Group" onPress={() => navigation.navigate('CreateGroup')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  tripList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  tripInfo: {
    flex: 1,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  pill: {
    backgroundColor: '#EEF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  pillText: {
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
    lineHeight: 20,
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friendCount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  friendList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  friendAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
  },
  friendAvatarText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  friendMeta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
