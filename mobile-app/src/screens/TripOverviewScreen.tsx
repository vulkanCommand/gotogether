import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Image, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useTripStore } from '../store/tripStore';

type Props = NativeStackScreenProps<RootStackParamList, 'TripOverview'>;

const heroImage =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470';

export default function TripOverviewScreen({ navigation }: Props) {
  const {
    currentTrip,
    crew,
    bestMatchRange,
    destinationOptions,
    selectedDestinationId,
    tripLead,
    itineraryDays,
  } = useTripStore();

  const selectedDestination = useMemo(() => {
    return destinationOptions.find((item) => item.id === selectedDestinationId) ?? null;
  }, [destinationOptions, selectedDestinationId]);

  const crewSubtitle = useMemo(() => {
    if (crew.length === 0) {
      return 'No crew selected yet';
    }

    if (crew.length <= 3) {
      return crew.map((member) => member.name).join(', ');
    }

    return `${crew[0].name}, ${crew[1].name}, ${crew[2].name} and ${crew.length - 3} more`;
  }, [crew]);

  const totalPlans = itineraryDays.reduce((sum, day) => sum + day.events.length, 0);

  const nextPlan = useMemo(() => {
    for (const day of itineraryDays) {
      const nextEvent =
        day.events.find((event) => event.status === 'upcoming') ??
        day.events.find((event) => event.status === 'active');

      if (nextEvent) {
        return {
          eyebrow: 'Next up',
          time: `${day.title} • ${nextEvent.time}`,
          title: nextEvent.title,
          meta: `${nextEvent.location} • ${nextEvent.attendees.join(', ') || 'Crew pending'}`,
        };
      }
    }

    return {
      eyebrow: 'Next up',
      time: 'Itinerary pending',
      title: 'Start building your trip plan',
      meta: 'Open itinerary and add your first event',
    };
  }, [itineraryDays]);

  const progressItems = [
    { label: 'Dates locked', done: !!bestMatchRange },
    { label: 'Destination selected', done: !!selectedDestination },
    { label: 'Lead assigned', done: !!tripLead },
    { label: 'Itinerary in progress', done: itineraryDays.length > 0 },
  ];

  const decisions = [
    {
      title: 'Destination',
      status: selectedDestination ? 'Locked' : 'Pending',
      meta: selectedDestination?.name ?? 'No destination selected yet',
      locked: !!selectedDestination,
    },
    {
      title: 'Trip lead',
      status: tripLead ? 'Assigned' : 'Pending',
      meta: tripLead?.name ?? 'No trip lead selected yet',
      locked: !!tripLead,
    },
  ];

  const pendingCount = decisions.filter((item) => !item.locked).length;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SectionTitle
          title="Trip Overview"
          subtitle="Everything your crew needs in one place."
        />

        <Image source={{ uri: heroImage }} style={styles.hero} />

        <AppCard>
          <View style={styles.headerTop}>
            <View style={styles.titleBlock}>
              <Text style={styles.trip}>
                {currentTrip?.name ?? selectedDestination?.name ?? 'Your Trip'}
              </Text>
              <Text style={styles.meta}>
                {(currentTrip ? `${currentTrip.start_date} → ${currentTrip.end_date}` : bestMatchRange || 'Dates not selected') +
                  ' • ' +
                  (currentTrip?.destination ?? selectedDestination?.name ?? 'Destination pending')}
              </Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {currentTrip?.members_count ?? crew.length ?? 0} people
              </Text>
            </View>
          </View>

          <View style={styles.peopleRow}>
            <View style={styles.avatarStack}>
              {crew.length > 0 ? (
                crew.slice(0, 4).map((member, index) => (
                  <Avatar
                    key={member.id}
                    label={
                      index === 3 && crew.length > 4
                        ? `+${crew.length - 3}`
                        : member.name.charAt(0).toUpperCase()
                    }
                    overlap={index !== 0}
                    muted={index === 3 && crew.length > 4}
                  />
                ))
              ) : (
                <Avatar label="?" />
              )}
            </View>

            <View style={styles.peopleInfo}>
              <Text style={styles.peopleTitle}>Your crew</Text>
              <Text style={styles.peopleSubtitle}>{crewSubtitle}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.progressWrap}>
            {progressItems.map((item) => (
              <ProgressItem
                key={item.label}
                label={item.label}
                done={item.done}
              />
            ))}
          </View>

          <SectionCard style={styles.leadCard}>
            <View style={styles.leadAvatar}>
              <Text style={styles.leadAvatarText}>
                {tripLead?.name?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>

            <View style={styles.leadInfo}>
              <Text style={styles.leadLabel}>Trip lead</Text>
              <Text style={styles.leadName}>
                {tripLead ? `${tripLead.name} is coordinating this trip` : 'No trip lead assigned yet'}
              </Text>
            </View>

            <View style={styles.leadPill}>
              <Text style={styles.leadPillText}>
                {tripLead ? 'Assigned' : 'Pending'}
              </Text>
            </View>
          </SectionCard>

          <View style={styles.statsRow}>
            <StatCard value={String(itineraryDays.length)} label="Days" />
            <StatCard value={String(totalPlans)} label="Plans" />
            <StatCard value={String(currentTrip?.members_count ?? crew.length)} label="Crew" />
          </View>

          <SectionCard style={styles.nextPlanCard}>
            <View style={styles.nextPlanTop}>
              <Text style={styles.nextPlanEyebrow}>{nextPlan.eyebrow}</Text>
              <Text style={styles.nextPlanTime}>{nextPlan.time}</Text>
            </View>

            <Text style={styles.nextPlanTitle}>{nextPlan.title}</Text>
            <Text style={styles.nextPlanMeta}>{nextPlan.meta}</Text>
          </SectionCard>

          <SectionCard style={styles.decisionsCard}>
            <View style={styles.decisionsHeader}>
              <Text style={styles.decisionsTitle}>Group decisions</Text>
              <Text style={styles.decisionsSummary}>
                {pendingCount} pending
              </Text>
            </View>

            {decisions.map((decision) => (
              <DecisionRow
                key={decision.title}
                title={decision.title}
                status={decision.status}
                meta={decision.meta}
                locked={decision.locked}
              />
            ))}
          </SectionCard>
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton
            title="View Itinerary"
            onPress={() => navigation.navigate('Itinerary')}
          />
          <PrimaryButton
            title="Split Expenses"
            variant="secondary"
            onPress={() => navigation.navigate('AddExpense')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.sectionCardBase, style]}>{children}</View>;
}

function ProgressItem({ label, done }: { label: string; done?: boolean }) {
  return (
    <View style={styles.progressItem}>
      <View
        style={[
          styles.dot,
          { backgroundColor: done ? colors.accent : '#E5E7EB' },
        ]}
      />
      <Text
        style={[
          styles.progressText,
          { opacity: done ? 1 : 0.5 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function Avatar({
  label,
  overlap,
  muted,
}: {
  label: string;
  overlap?: boolean;
  muted?: boolean;
}) {
  return (
    <View
      style={[
        styles.avatar,
        overlap && styles.avatarOverlap,
        muted && styles.avatarMuted,
      ]}
    >
      <Text style={[styles.avatarText, muted && styles.avatarTextMuted]}>
        {label}
      </Text>
    </View>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DecisionRow({
  title,
  status,
  meta,
  locked,
}: {
  title: string;
  status: string;
  meta: string;
  locked?: boolean;
}) {
  return (
    <View style={styles.decisionRow}>
      <View style={styles.decisionInfo}>
        <Text style={styles.decisionTitle}>{title}</Text>
        <Text style={styles.decisionMeta}>{meta}</Text>
      </View>

      <View style={[styles.decisionPill, locked && styles.decisionPillLocked]}>
        <Text
          style={[
            styles.decisionPillText,
            locked && styles.decisionPillTextLocked,
          ]}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  hero: {
    height: 220,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  trip: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  badgeText: {
    color: colors.accent,
    fontWeight: '600',
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarMuted: {
    backgroundColor: '#E5E7EB',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  avatarTextMuted: {
    color: colors.textSecondary,
  },
  peopleInfo: {
    flex: 1,
  },
  peopleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  peopleSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  progressWrap: {
    gap: spacing.sm,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  sectionCardBase: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  leadCard: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  leadInfo: {
    flex: 1,
  },
  leadLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  leadName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  leadPill: {
    backgroundColor: '#E8F0FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  leadPillText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
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
  nextPlanCard: {
    marginTop: spacing.md,
  },
  nextPlanTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextPlanEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  nextPlanTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  nextPlanTitle: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  nextPlanMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  decisionsCard: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  decisionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  decisionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  decisionsSummary: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  decisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  decisionInfo: {
    flex: 1,
  },
  decisionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  decisionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  decisionPill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  decisionPillLocked: {
    backgroundColor: '#ECFDF5',
  },
  decisionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  decisionPillTextLocked: {
    color: colors.success,
  },
  actions: {
    gap: spacing.sm,
  },
});