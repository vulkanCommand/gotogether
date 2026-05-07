import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import Pill from '../components/Pill';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { RootStackParamList } from '../navigation/AppNavigator';
import { saveTripSetupStatus } from '../config/api';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { getMemberProposalMeta, summarizeCrewProgress } from '../utils/tripCoordination';

type Props = NativeStackScreenProps<RootStackParamList, 'TripSetup'>;

type DateOption = {
  value: string;
  label: string;
  shortLabel: string;
};

const parseTripDate = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const buildTripDateOptions = (start?: string, end?: string): DateOption[] => {
  const startDate = parseTripDate(start);
  const endDate = parseTripDate(end);
  if (!startDate || !endDate || endDate < startDate) {
    return Array.from({ length: 7 }, (_, index) => {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + index);
      return {
        value: toISODate(fallback),
        label: formatDateLabel(fallback),
        shortLabel: String(fallback.getDate()),
      };
    });
  }

  const options: DateOption[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate && options.length < 60) {
    options.push({
      value: toISODate(cursor),
      label: formatDateLabel(cursor),
      shortLabel: String(cursor.getDate()),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return options;
};

export default function TripSetupScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const crew = useTripStore((state) => state.crew);
  const tripLead = useTripStore((state) => state.tripLead);
  const setTripSelectedDates = useTripStore((state) => state.setSelectedDates);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [leadVoteUserId, setLeadVoteUserId] = useState<number>(Number(currentTrip?.lead_user_id || crew[0]?.id || 0));
  const [saving, setSaving] = useState(false);

  const tripName = currentTrip?.name ?? 'Trip setup';
  const tripDateOptions = useMemo(
    () => buildTripDateOptions(currentTrip?.start_date, currentTrip?.end_date),
    [currentTrip?.end_date, currentTrip?.start_date]
  );
  const sortedDates = useMemo(
    () => selectedDates.slice().sort((a, b) => a.localeCompare(b)),
    [selectedDates]
  );
  const crewProgress = useMemo(() => summarizeCrewProgress(crew), [crew]);

  useEffect(() => {
    if (tripDateOptions.length > 0 && selectedDates.length === 0) {
      setSelectedDates(tripDateOptions.map((option) => option.value));
    }
  }, [selectedDates.length, tripDateOptions]);

  const toggleDate = (day: string) => {
    setSelectedDates((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
    );
  };

  const saveSetup = async () => {
    if (!currentTrip?.id) {
      return;
    }
    if (selectedDates.length === 0 || leadVoteUserId <= 0) {
      Alert.alert('Setup needed', 'Choose your available dates and vote for a trip lead.');
      return;
    }

    try {
      setSaving(true);
      await saveTripSetupStatus(currentTrip.id, {
        availableDates: sortedDates,
        leadVoteUserId,
      });
      setTripSelectedDates(sortedDates);
      navigation.replace('TripOverview');
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen showFooter showBackButton>
      <SectionTitle
        title="Confirm Proposal"
        subtitle={`Review the proposed plan for ${tripName}, confirm which dates work for you, and cast your lead vote.`}
        action={<NotificationBell />}
      />

      <AppCard>
        <Text style={styles.cardTitle}>Proposed trip</Text>
        <Text style={styles.cardMeta}>
          Destination: {currentTrip?.destination || 'Pending'}
        </Text>
        <Text style={styles.cardMeta}>
          Window: {currentTrip?.start_date && currentTrip?.end_date ? `${currentTrip.start_date} - ${currentTrip.end_date}` : 'Pending'}
        </Text>
        <Text style={styles.cardMeta}>
          Suggested organizer: {tripLead?.name || crew[0]?.name || 'Pending'}
        </Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Crew progress</Text>
        <Text style={styles.cardMeta}>
          {crewProgress.confirmedCount}/{crewProgress.totalCount} people have confirmed the proposal so far.
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(8, crewProgress.progressRatio * 100)}%` }]} />
        </View>
        <Text style={styles.progressSupport}>
          {crewProgress.pendingNames.length > 0
            ? `Still waiting on ${crewProgress.pendingNames.join(', ')}.`
            : 'Everyone is confirmed, so the lead vote will finalize next.'}
        </Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Your available dates</Text>
        <Text style={styles.cardMeta}>The full proposed trip window is preselected. Remove any dates you cannot make.</Text>
        <View style={styles.calendarGrid}>
          {tripDateOptions.map((day) => {
            const selected = selectedDates.includes(day.value);
            return (
              <Pressable
                key={day.value}
                style={[styles.dayChip, selected && styles.dayChipSelected]}
                onPress={() => toggleDate(day.value)}
              >
                <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day.shortLabel}</Text>
                <Text style={[styles.dayMeta, selected && styles.dayTextSelected]}>{day.label.split(',')[0]}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Vote for trip lead</Text>
        <Text style={styles.cardMeta}>Pick who should own itinerary decisions after the crew finishes setup.</Text>
        <View style={styles.memberList}>
          {crew.map((member) => {
            const selected = leadVoteUserId === Number(member.id);
            const proposalMeta = getMemberProposalMeta(member.proposalStatus);
            return (
              <Pressable
                key={member.id}
                style={[styles.memberRow, selected && styles.memberRowSelected]}
                onPress={() => setLeadVoteUserId(Number(member.id))}
              >
                <View style={styles.memberVoteCopy}>
                  <View style={styles.memberNameRow}>
                    <Text style={[styles.memberName, selected && styles.memberNameSelected]}>{member.name}</Text>
                    {member.isViewer ? <Text style={styles.youTag}>You</Text> : null}
                  </View>
                  <Text style={styles.memberRole}>
                    {proposalMeta.key === 'confirmed'
                      ? 'Confirmed and counted in the proposal'
                      : proposalMeta.key === 'needs_response'
                        ? 'Still needs to submit dates and lead vote'
                        : 'Waiting for proposal response'}
                  </Text>
                </View>
                <View style={styles.memberVoteBadges}>
                  <Pill label={proposalMeta.label} tone={proposalMeta.tone} />
                  {tripLead?.id === member.id ? <Pill label="Suggested lead" tone="accent" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <PrimaryButton title={saving ? 'Saving...' : 'Continue to Trip'} onPress={saveSetup} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardMeta: {
    marginTop: 6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  dayChip: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  dayMeta: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  memberList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  progressTrack: {
    marginTop: spacing.md,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: '#E8EEF8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  progressSupport: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  memberRowSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  memberVoteCopy: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberNameSelected: {
    color: colors.accent,
  },
  youTag: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.accentStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  memberRole: {
    marginTop: 4,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  memberVoteBadges: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
