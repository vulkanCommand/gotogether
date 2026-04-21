import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { CrewMember, DestinationOption, useTripStore } from '../store/tripStore';
import { members as mockMembers } from '../data/mock';
import { apiRequest, ApiTrip } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'TripCreate'>;

const steps = ['Dates', 'Destination', 'Trip Lead'];

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const monthLabel = 'April 2026';
const dayOffset = 3;
const calendarDays = Array.from({ length: 30 }, (_, index) => index + 1);

const destinationSeed: DestinationOption[] = [
  {
    id: '1',
    name: 'Santorini',
    country: 'Greece',
    emoji: '🏝️',
    accent: '#E8F0FF',
    votes: ['1', '2', '3'],
  },
  {
    id: '2',
    name: 'Bali',
    country: 'Indonesia',
    emoji: '🌴',
    accent: '#F3ECFF',
    votes: ['4', '5'],
  },
  {
    id: '3',
    name: 'Swiss Alps',
    country: 'Switzerland',
    emoji: '🏔️',
    accent: '#ECFDF5',
    votes: ['6'],
  },
];

const roleLabels = ['Organizer', 'Food planner', 'Driver', 'Stay scout', 'Budget lead', 'Photo lead'];

const availabilitySeed = ['Available', 'Available', 'Available', 'Available', 'Maybe', 'Unavailable'] as const;

export default function TripCreateScreen({ navigation }: Props) {
  const crew = useTripStore((state) => state.crew);
  const selectedDates = useTripStore((state) => state.selectedDates);
  const bestMatchRange = useTripStore((state) => state.bestMatchRange);
  const destinationOptions = useTripStore((state) => state.destinationOptions);
  const selectedDestinationId = useTripStore((state) => state.selectedDestinationId);
  const tripLead = useTripStore((state) => state.tripLead);

  const setCrew = useTripStore((state) => state.setCrew);
  const setSelectedDates = useTripStore((state) => state.setSelectedDates);
  const toggleSelectedDate = useTripStore((state) => state.toggleSelectedDate);
  const setBestMatchRange = useTripStore((state) => state.setBestMatchRange);
  const setDestinationOptions = useTripStore((state) => state.setDestinationOptions);
  const setSelectedDestinationId = useTripStore((state) => state.setSelectedDestinationId);
  const voteDestination = useTripStore((state) => state.voteDestination);
  const setTripLead = useTripStore((state) => state.setTripLead);
  const hydratePlannerDefaults = useTripStore((state) => state.hydratePlannerDefaults);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const resetPlannerState = useTripStore((state) => state.resetPlannerState);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const fallbackCrew = useMemo<CrewMember[]>(
    () =>
      mockMembers.slice(0, 4).map((member, index) => ({
        id: member.id,
        name: member.name,
        role: roleLabels[index] ?? 'Crew member',
      })),
    []
  );

  const plannerCrew = useMemo<CrewMember[]>(() => {
    if (crew.length === 0) {
      return fallbackCrew;
    }

    return crew.map((member, index) => ({
      ...member,
      role: member.role ?? roleLabels[index] ?? 'Crew member',
    }));
  }, [crew, fallbackCrew]);

  useEffect(() => {
    hydratePlannerDefaults({
      crew: fallbackCrew,
      destinationOptions: destinationSeed,
    });

    if (crew.length === 0) {
      setCrew(fallbackCrew);
    }
  }, [crew.length, fallbackCrew, hydratePlannerDefaults, setCrew]);

  const activeDates = useMemo(() => {
    const parsed = selectedDates
      .map((date) => Number(date))
      .filter((value) => !Number.isNaN(value));

    return [...parsed].sort((a, b) => a - b);
  }, [selectedDates]);

  const matchedRange = useMemo(() => {
    if (activeDates.length === 0) {
      return '';
    }

    if (activeDates.length === 1) {
      return `Apr ${activeDates[0]}`;
    }

    return `Apr ${activeDates[0]} – Apr ${activeDates[activeDates.length - 1]}`;
  }, [activeDates]);

  useEffect(() => {
    if (matchedRange) {
      setBestMatchRange(matchedRange);
    } else if (bestMatchRange) {
      setBestMatchRange('');
    }
  }, [bestMatchRange, matchedRange, setBestMatchRange]);

  useEffect(() => {
    if (destinationOptions.length === 0) {
      setDestinationOptions(destinationSeed);
    }
  }, [destinationOptions.length, setDestinationOptions]);

  useEffect(() => {
    if (!tripLead && plannerCrew.length > 0) {
      setTripLead(plannerCrew[0]);
    }
  }, [plannerCrew, setTripLead, tripLead]);

  const selectedDestination = useMemo(() => {
    return (
      destinationOptions.find((destination) => destination.id === selectedDestinationId) ?? null
    );
  }, [destinationOptions, selectedDestinationId]);

  const selectedLeadId = tripLead?.id ?? plannerCrew[0]?.id ?? '';

  const availabilityRows = useMemo(() => {
    const base = plannerCrew.map((member, index) => ({
      name: member.name,
      status: availabilitySeed[index] ?? 'Available',
    }));

    if (base.length >= 4) {
      return base;
    }

    return [
      ...base,
      { name: 'Nina', status: 'Maybe' as const },
      { name: 'Ravi', status: 'Unavailable' as const },
    ];
  }, [plannerCrew]);

  const handleDateToggle = (day: number) => {
    toggleSelectedDate(String(day));
  };

  const handleDestinationSelect = (destinationId: string) => {
    const actingMemberId = plannerCrew[0]?.id ?? '1';

    setSelectedDestinationId(destinationId);
    voteDestination(destinationId, actingMemberId);
  };

  const handleLeadSelect = (member: CrewMember) => {
    setTripLead(member);
  };

  const goNext = async () => {
    if (step === 0 && activeDates.length === 0) {
      Alert.alert('Select dates', 'Choose at least one date before continuing.');
      return;
    }

    if (step === 1 && !selectedDestination) {
      Alert.alert('Select destination', 'Choose one destination before continuing.');
      return;
    }

    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }

    if (!selectedDestination || !matchedRange || activeDates.length === 0) {
      Alert.alert('Trip incomplete', 'Please finish dates and destination first.');
      return;
    }

    try {
      setSaving(true);
      resetPlannerState();
      setCrew(plannerCrew);
      setSelectedDates(activeDates.map(String));
      setBestMatchRange(matchedRange);
      setDestinationOptions(destinationOptions);
      setSelectedDestinationId(selectedDestination.id);
      setTripLead(tripLead ?? plannerCrew[0] ?? null);

      const created = await apiRequest<{ trip: ApiTrip }>('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: `${selectedDestination.name} Trip`,
          destination: selectedDestination.name,
          start_date: `2026-04-${String(activeDates[0]).padStart(2, '0')}`,
          end_date: `2026-04-${String(activeDates[activeDates.length - 1]).padStart(2, '0')}`,
        }),
      });

      setCurrentTrip(created.trip);
      navigation.navigate('TripOverview');
    } catch (error: any) {
      console.log('Create trip failed', error);
      Alert.alert('Trip creation failed', error?.message || 'Could not save trip to backend');
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep((current) => current - 1);
      return;
    }

    navigation.goBack();
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Create Trip"
          subtitle="Match dates, lock a location, choose a trip lead, then move into itinerary and expenses."
        />

        <AppCard>
          <View style={styles.stepHeader}>
            {steps.map((label, index) => {
              const active = index === step;
              const complete = index < step;

              return (
                <View key={label} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      active && styles.stepCircleActive,
                      complete && styles.stepCircleComplete,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepCircleText,
                        active && styles.stepCircleTextActive,
                        complete && styles.stepCircleTextComplete,
                      ]}
                    >
                      {complete ? '✓' : index + 1}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.stepLabel,
                      active && styles.stepLabelActive,
                      complete && styles.stepLabelComplete,
                    ]}
                  >
                    {label}
                  </Text>

                  {index < steps.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        index < step && styles.stepLineComplete,
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </AppCard>

        {step === 0 && (
          <>
            <AppCard>
              <Text style={styles.eyebrow}>Step 1</Text>
              <Text style={styles.cardTitle}>Availability matching</Text>
              <Text style={styles.cardMeta}>
                Tap the dates your group can do. This becomes the first real trip input before voting.
              </Text>

              <View style={styles.calendarHeader}>
                <Text style={styles.calendarMonth}>{monthLabel}</Text>
                <View style={styles.calendarHintPill}>
                  <Text style={styles.calendarHintText}>{activeDates.length} selected</Text>
                </View>
              </View>

              <View style={styles.weekdayRow}>
                {weekdayLabels.map((day, index) => (
                  <Text key={`${day}-${index}`} style={styles.weekdayLabel}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {Array.from({ length: dayOffset }).map((_, index) => (
                  <View key={`empty-${index}`} style={styles.emptyCell} />
                ))}

                {calendarDays.map((day) => {
                  const selected = selectedDates.includes(String(day));

                  return (
                    <Pressable
                      key={day}
                      onPress={() => handleDateToggle(day)}
                      style={[styles.dayCell, selected && styles.dayCellSelected]}
                    >
                      <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>

            <AppCard>
              <View style={styles.matchHeader}>
                <View>
                  <Text style={styles.eyebrow}>Best match</Text>
                  <Text style={styles.matchTitle}>{matchedRange || 'Select dates'}</Text>
                </View>

                <View style={styles.matchPill}>
                  <Text style={styles.matchPillText}>
                    {plannerCrew.length} of {plannerCrew.length + 2} available
                  </Text>
                </View>
              </View>

              <Text style={styles.matchText}>
                This overlap is now stored in the app flow, so your overview and itinerary can use the same trip window.
              </Text>

              <View style={styles.availabilityList}>
                {availabilityRows.map((item, index) => (
                  <View key={`${item.name}-${index}`} style={styles.availabilityRow}>
                    <Text style={styles.availabilityName}>{item.name}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        item.status === 'Available' && styles.statusBadgeAvailable,
                        item.status === 'Maybe' && styles.statusBadgeMaybe,
                        item.status === 'Unavailable' && styles.statusBadgeUnavailable,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          item.status === 'Available' && styles.statusBadgeTextAvailable,
                          item.status === 'Maybe' && styles.statusBadgeTextMaybe,
                          item.status === 'Unavailable' && styles.statusBadgeTextUnavailable,
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </AppCard>
          </>
        )}

        {step === 1 && (
          <>
            <AppCard>
              <Text style={styles.eyebrow}>Step 2</Text>
              <Text style={styles.cardTitle}>Location voting</Text>
              <Text style={styles.cardMeta}>
                Once dates are matched, pick the place. The winner becomes the trip destination shown in overview.
              </Text>

              <View style={styles.destinationList}>
                {destinationOptions.map((destination) => {
                  const selected = destination.id === selectedDestinationId;

                  return (
                    <Pressable
                      key={destination.id}
                      onPress={() => handleDestinationSelect(destination.id)}
                      style={[styles.destinationCard, selected && styles.destinationCardSelected]}
                    >
                      <View
                        style={[
                          styles.destinationVisual,
                          { backgroundColor: destination.accent ?? '#EEF2FF' },
                        ]}
                      >
                        <Text style={styles.destinationEmoji}>{destination.emoji ?? '✈️'}</Text>
                      </View>

                      <View style={styles.destinationInfo}>
                        <Text style={styles.destinationTitle}>{destination.name}</Text>
                        <Text style={styles.destinationCountry}>{destination.country ?? 'Open destination'}</Text>
                        <Text style={styles.destinationVotes}>{destination.votes.length} votes</Text>
                      </View>

                      <View style={[styles.voteIndicator, selected && styles.voteIndicatorSelected]}>
                        <Text
                          style={[
                            styles.voteIndicatorText,
                            selected && styles.voteIndicatorTextSelected,
                          ]}
                        >
                          {selected ? 'Selected' : 'Vote'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>

            <AppCard>
              <View style={styles.choiceHeader}>
                <View>
                  <Text style={styles.eyebrow}>Current winner</Text>
                  <Text style={styles.choiceTitle}>
                    {selectedDestination
                      ? `${selectedDestination.name}, ${selectedDestination.country}`
                      : 'Pick a destination'}
                  </Text>
                </View>

                <View style={styles.choicePill}>
                  <Text style={styles.choicePillText}>Store-backed</Text>
                </View>
              </View>

              <Text style={styles.choiceMeta}>
                This choice now carries forward through the rest of the trip flow instead of staying trapped on this screen.
              </Text>
            </AppCard>
          </>
        )}

        {step === 2 && (
          <>
            <AppCard>
              <Text style={styles.eyebrow}>Step 3</Text>
              <Text style={styles.cardTitle}>Trip lead voting</Text>
              <Text style={styles.cardMeta}>
                Pick the person who will coordinate the trip and own the itinerary decisions.
              </Text>

              <View style={styles.leadGrid}>
                {plannerCrew.map((member) => {
                  const selected = member.id === selectedLeadId;

                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => handleLeadSelect(member)}
                      style={[styles.leadCard, selected && styles.leadCardSelected]}
                    >
                      <View style={[styles.leadAvatar, selected && styles.leadAvatarSelected]}>
                        <Text
                          style={[
                            styles.leadAvatarText,
                            selected && styles.leadAvatarTextSelected,
                          ]}
                        >
                          {member.name.charAt(0)}
                        </Text>
                      </View>

                      <Text style={styles.leadName}>{member.name}</Text>
                      <Text style={styles.leadRole}>{member.role ?? 'Crew member'}</Text>

                      <View style={[styles.leadPickPill, selected && styles.leadPickPillSelected]}>
                        <Text
                          style={[
                            styles.leadPickText,
                            selected && styles.leadPickTextSelected,
                          ]}
                        >
                          {selected ? 'Chosen lead' : 'Choose'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>

            <AppCard>
              <Text style={styles.eyebrow}>Trip summary</Text>
              <Text style={styles.summaryTitle}>Ready for overview</Text>

              <View style={styles.summaryBlock}>
                <SummaryRow label="Crew size" value={`${plannerCrew.length} people`} />
                <SummaryRow label="Matched dates" value={matchedRange || 'Not selected'} />
                <SummaryRow
                  label="Destination"
                  value={
                    selectedDestination
                      ? `${selectedDestination.name}, ${selectedDestination.country}`
                      : 'Not selected'
                  }
                />
                <SummaryRow
                  label="Trip lead"
                  value={tripLead?.name ?? 'Not selected'}
                  isLast
                />
              </View>

              <Text style={styles.summaryNote}>
                After this, you’ll land in Trip Overview. From there you can open itinerary and start building events.
              </Text>
            </AppCard>
          </>
        )}

        <View style={styles.actionRow}>
          <PrimaryButton
            title={step === 0 ? 'Back' : 'Previous'}
            variant="secondary"
            onPress={goBack}
          />
          <PrimaryButton
            title={step < 2 ? 'Continue' : 'Continue to Overview'}
            onPress={goNext}
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
  content: {
    paddingBottom: spacing.xl,
  },

  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },

  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepCircleActive: {
    backgroundColor: '#EEF4FF',
    borderColor: '#B9D2FF',
  },

  stepCircleComplete: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  stepCircleText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
  },

  stepCircleTextActive: {
    color: colors.accent,
  },

  stepCircleTextComplete: {
    color: '#FFFFFF',
  },

  stepLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  stepLabelActive: {
    color: colors.textPrimary,
  },

  stepLabelComplete: {
    color: colors.accent,
  },

  stepLine: {
    position: 'absolute',
    top: 16,
    right: '-48%',
    width: '96%',
    height: 2,
    backgroundColor: '#E5E7EB',
    zIndex: -1,
  },

  stepLineComplete: {
    backgroundColor: colors.accent,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.sm,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  cardMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  calendarMonth: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  calendarHintPill: {
    backgroundColor: '#EEF4FF',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  calendarHintText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },

  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  emptyCell: {
    width: '12.8%',
    aspectRatio: 1,
  },

  dayCell: {
    width: '12.8%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayCellSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  dayText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  dayTextSelected: {
    color: '#FFFFFF',
  },

  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },

  matchTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  matchPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  matchPillText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },

  matchText: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  availabilityList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },

  availabilityName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusBadgeAvailable: {
    backgroundColor: '#ECFDF5',
  },

  statusBadgeMaybe: {
    backgroundColor: '#FFF7ED',
  },

  statusBadgeUnavailable: {
    backgroundColor: '#F3F4F6',
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  statusBadgeTextAvailable: {
    color: colors.success,
  },

  statusBadgeTextMaybe: {
    color: colors.warning,
  },

  statusBadgeTextUnavailable: {
    color: colors.textSecondary,
  },

  destinationList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.lg,
    padding: spacing.md,
  },

  destinationCardSelected: {
    borderColor: '#B9D2FF',
    backgroundColor: '#F8FBFF',
  },

  destinationVisual: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  destinationEmoji: {
    fontSize: 30,
  },

  destinationInfo: {
    flex: 1,
  },

  destinationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  destinationCountry: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },

  destinationVotes: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },

  voteIndicator: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F3F4F6',
  },

  voteIndicatorSelected: {
    backgroundColor: '#EEF4FF',
  },

  voteIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  voteIndicatorTextSelected: {
    color: colors.accent,
  },

  choiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },

  choiceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  choicePill: {
    backgroundColor: '#F3F4F6',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  choicePillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },

  choiceMeta: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  leadGrid: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  leadCard: {
    width: '48.5%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },

  leadCardSelected: {
    backgroundColor: '#F8FBFF',
    borderColor: '#B9D2FF',
  },

  leadAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  leadAvatarSelected: {
    backgroundColor: colors.accent,
  },

  leadAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  leadAvatarTextSelected: {
    color: '#FFFFFF',
  },

  leadName: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  leadRole: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  leadPickPill: {
    marginTop: spacing.sm,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  leadPickPillSelected: {
    backgroundColor: '#EEF4FF',
  },

  leadPickText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  leadPickTextSelected: {
    color: colors.accent,
  },

  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  summaryBlock: {
    marginTop: spacing.md,
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

  summaryNote: {
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  actionRow: {
    gap: spacing.sm,
  },
});