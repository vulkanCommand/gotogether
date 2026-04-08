import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { trips } from '../data/mock';
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

export default function TripsScreen({ navigation }: Props) {
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
            <Text style={styles.meta}>{trip.date}</Text>

            <View style={styles.bottom}>
              <Text style={styles.destination}>{trip.destination}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{trip.progress}</Text>
              </View>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.members}>{trip.members} members</Text>
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