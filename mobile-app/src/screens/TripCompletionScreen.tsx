import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useTripStore } from '../store/tripStore';

type Props = NativeStackScreenProps<RootStackParamList, 'TripCompletion'>;

export default function TripCompletionScreen({ navigation }: Props) {
  const crew = useTripStore((state) => state.crew);
  const bestMatchRange = useTripStore((state) => state.bestMatchRange);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const expenses = useTripStore((state) => state.expenses);
  const tripLead = useTripStore((state) => state.tripLead);
  const selectedDestination = useTripStore((state) => state.selectedDestination);
  const totalPlans = useTripStore((state) => state.totalPlans);
  const totalExpenseAmount = useTripStore((state) => state.totalExpenseAmount);
  const resetTrip = useTripStore((state) => state.resetTrip);

  const destination = selectedDestination();

  const members = useMemo(() => {
    if (crew.length === 0) {
      return [
        {
          id: 'fallback-1',
          name: 'Crew pending',
          avatar: 'https://i.pravatar.cc/100?img=1',
          confirmed: false,
        },
      ];
    }

    return crew.map((member, index) => ({
      id: member.id,
      name: member.name,
      avatar: `https://i.pravatar.cc/100?img=${index + 1}`,
      confirmed: true,
    }));
  }, [crew]);

  const confirmedCount = members.filter((member) => member.confirmed).length;

  const tripMeta = [
    bestMatchRange || 'Dates pending',
    destination?.country
      ? `${destination.name}, ${destination.country}`
      : destination?.name ?? 'Destination pending',
  ].join(' • ');

  const totalDays = itineraryDays.length;
  const totalLoggedExpenses = expenses.length;
  const leadName = tripLead?.name ?? 'Lead pending';

  const handleFinish = () => {
    resetTrip();
    navigation.navigate('MainTabs');
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SectionTitle
          title="Trip Completion"
          subtitle="Final summary, crew confirmation, and a clean end to the full trip flow."
        />

        <AppCard style={styles.heroCard}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.heroTitle}>Trip Completed!</Text>
          <Text style={styles.tripName}>{destination?.name ?? 'Your Trip'}</Text>
          <Text style={styles.tripMeta}>{tripMeta}</Text>
          <Text style={styles.heroNote}>
            Your frontend flow now carries trip setup, itinerary, and expenses all the way to completion.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{crew.length}</Text>
              <Text style={styles.statLabel}>Crew</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalPlans()}</Text>
              <Text style={styles.statLabel}>Plans</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalDays}</Text>
              <Text style={styles.statLabel}>Days</Text>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Trip summary</Text>
              <Text style={styles.summaryTitle}>Everything tied together</Text>
            </View>

            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>Store-backed</Text>
            </View>
          </View>

          <View style={styles.summaryList}>
            <SummaryRow
              label="Destination"
              value={
                destination?.country
                  ? `${destination.name}, ${destination.country}`
                  : destination?.name ?? 'Pending'
              }
            />
            <SummaryRow label="Dates" value={bestMatchRange || 'Pending'} />
            <SummaryRow label="Trip lead" value={leadName} />
            <SummaryRow label="Plans built" value={`${totalPlans()}`} />
            <SummaryRow label="Expenses logged" value={`${totalLoggedExpenses}`} />
            <SummaryRow
              label="Total spend"
              value={`$${totalExpenseAmount().toFixed(2)}`}
              isLast
            />
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.sectionEyebrow}>Shared memory</Text>

          <Pressable style={styles.photoUploadCard}>
            <View style={styles.photoIconWrap}>
              <Text style={styles.photoIcon}>📷</Text>
            </View>
            <Text style={styles.photoTitle}>Upload a group photo</Text>
            <Text style={styles.photoSubtitle}>
              Keep this as the placeholder for future media upload flow after backend work starts.
            </Text>
          </Pressable>
        </AppCard>

        <AppCard>
          <View style={styles.confirmationHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Crew confirmation</Text>
              <Text style={styles.confirmationSummary}>
                {confirmedCount} of {members.length} confirmed
              </Text>
            </View>

            <View style={styles.confirmedPill}>
              <Text style={styles.confirmedPillText}>Final status</Text>
            </View>
          </View>

          <View style={styles.memberList}>
            {members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberLeft}>
                  <Image source={{ uri: member.avatar }} style={styles.avatar} />
                  <Text style={styles.memberName}>{member.name}</Text>
                </View>

                {member.confirmed ? (
                  <View style={styles.checkWrap}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingPillText}>Pending</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton title="Finish Trip" onPress={handleFinish} />
          <PrimaryButton
            title="Back to Trips"
            variant="secondary"
            onPress={handleFinish}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, isLast && styles.summaryRowLast]}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  heroCard: {
    alignItems: 'center',
  },

  emoji: {
    fontSize: 42,
    marginBottom: spacing.sm,
  },

  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.6,
  },

  tripName: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  tripMeta: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  heroNote: {
    marginTop: spacing.md,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },

  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },

  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },

  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.sm,
  },

  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  summaryPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  summaryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  summaryList: {
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    overflow: 'hidden',
  },

  summaryRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  summaryRowLast: {
    borderBottomWidth: 0,
  },

  summaryRowLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },

  summaryRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  photoUploadCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: '#F8FAFC',
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },

  photoIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  photoIcon: {
    fontSize: 28,
  },

  photoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  photoSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  confirmationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  confirmationSummary: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  confirmedPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },

  confirmedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },

  memberList: {
    gap: spacing.sm,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },

  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EAF8EE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.success,
  },

  pendingPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  pendingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  actions: {
    gap: spacing.sm,
  },
});