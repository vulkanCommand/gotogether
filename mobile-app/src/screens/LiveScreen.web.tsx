import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NotificationBell from '../components/NotificationBell';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { isCompletedEvent, useTripStore } from '../store/tripStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Live'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function LiveScreenWeb({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const itineraryDays = useTripStore((state) => state.itineraryDays);

  const activeEvent =
    itineraryDays
      .flatMap((day) => day.events.map((event) => ({ dayTitle: day.title, event })))
      .find((item) => !isCompletedEvent(item.event)) ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 22) + 12 }]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Live</Text>
            <Text style={styles.headerSubtitle}>Map sharing works best in the mobile app, but your trip state is still here.</Text>
          </View>
          <NotificationBell />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="navigate" size={28} color={colors.accent} />
          </View>
          <Text style={styles.heroTitle}>Open Live on your phone</Text>
          <Text style={styles.heroText}>
            Browser preview skips native map and live location sharing, so this page keeps the trip context simple and readable.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>Current trip</Text>
          <Text style={styles.tripName}>{currentTrip?.name || 'No trip selected'}</Text>
          <Text style={styles.tripMeta}>{currentTrip?.destination || 'Destination pending'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>Next event</Text>
          {activeEvent ? (
            <>
              <Text style={styles.eventTitle}>{activeEvent.event.title}</Text>
              <Text style={styles.eventMeta}>
                {activeEvent.dayTitle} - {activeEvent.event.time}
              </Text>
              <Text style={styles.eventMeta}>{activeEvent.event.location || 'Location TBD'}</Text>
            </>
          ) : (
            <Text style={styles.emptyText}>Add itinerary events in the planner to see the next destination here.</Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('MainTabs', { screen: 'Trips' })}>
            <Text style={styles.secondaryButtonText}>Back to Trips</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Itinerary')}>
            <Text style={styles.primaryButtonText}>Open itinerary</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  sectionEyebrow: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  tripName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  tripMeta: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  eventTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  eventMeta: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  emptyText: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
