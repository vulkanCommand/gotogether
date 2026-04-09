import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Trips'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Trip = {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  members_count: number;
};

export default function TripsScreen({ navigation }: Props) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const TOKEN = 'PASTE_YOUR_TOKEN_HERE'; // temporary for testing

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const res = await fetch('http://10.0.2.2:8080/api/trips', {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      });

      const data = await res.json();
      setTrips(data.trips || []);
    } catch (err) {
      console.log('Failed to fetch trips', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateRange = (start: string, end: string) => {
    return `${start} → ${end}`;
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle
        title="Trips"
        subtitle="All your planning spaces in one place."
      />

      {trips.map((trip) => (
        <Pressable
          key={trip.id}
          onPress={() => navigation.navigate('TripOverview')}
        >
          <AppCard style={styles.card}>
            <Text style={styles.title}>{trip.name}</Text>
            <Text style={styles.meta}>
              {formatDateRange(trip.start_date, trip.end_date)}
            </Text>

            <View style={styles.bottom}>
              <Text style={styles.destination}>{trip.destination}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Active</Text>
              </View>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.members}>
                {trip.members_count} members
              </Text>
              <Text style={styles.openText}>Open trip</Text>
            </View>
          </AppCard>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
  },
  bottom: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  destination: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  members: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  openText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
});