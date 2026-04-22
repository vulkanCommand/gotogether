import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { CrewMember, DestinationOption, useTripStore } from '../store/tripStore';
import { ApiTrip, apiRequest } from '../config/api';
import { useAuthStore } from '../store/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'TripCreate'>;

const steps = ['Dates', 'Destination', 'Trip Lead'];
const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const monthLabel = 'April 2026';
const dayOffset = 3;
const calendarDays = Array.from({ length: 30 }, (_, index) => index + 1);
const roleLabels = ['Organizer', 'Navigator', 'Budget lead', 'Photo lead', 'Food scout', 'Planner'];

export default function TripCreateScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const crew = useTripStore((state) => state.crew);
  const selectedDates = useTripStore((state) => state.selectedDates);
  const bestMatchRange = useTripStore((state) => state.bestMatchRange);
  const destinationOptions = useTripStore((state) => state.destinationOptions);
  const selectedDestinationId = useTripStore((state) => state.selectedDestinationId);
  const tripLead = useTripStore((state) => state.tripLead);

  const setCrew = useTripStore((state) => state.setCrew);
  const toggleSelectedDate = useTripStore((state) => state.toggleSelectedDate);
  const setBestMatchRange = useTripStore((state) => state.setBestMatchRange);
  const setDestinationOptions = useTripStore((state) => state.setDestinationOptions);
  const setSelectedDestinationId = useTripStore((state) => state.setSelectedDestinationId);
  const voteDestination = useTripStore((state) => state.voteDestination);
  const setTripLead = useTripStore((state) => state.setTripLead);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const resetPlannerState = useTripStore((state) => state.resetPlannerState);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [destinationName, setDestinationName] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');

  const plannerCrew = useMemo<CrewMember[]>(() => {
    if (crew.length > 0) {
      return crew.map((member, index) => ({
        ...member,
        role: member.role ?? roleLabels[index] ?? 'Crew member',
      }));
    }

    if (!user) {
      return [];
    }

    return [
      {
        id: String(user.id),
        name: user.name || user.email,
        role: 'Organizer',
      },
    ];
  }, [crew, user]);

  useEffect(() => {
    if (crew.length === 0 && plannerCrew.length > 0) {
      setCrew(plannerCrew);
    }
  }, [crew.length, plannerCrew, setCrew]);

  useEffect(() => {
    if (!tripLead && plannerCrew.length > 0) {
      setTripLead(plannerCrew[0]);
    }
  }, [plannerCrew, setTripLead, tripLead]);

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

    return `Apr ${activeDates[0]} - Apr ${activeDates[activeDates.length - 1]}`;
  }, [activeDates]);

  useEffect(() => {
    setBestMatchRange(matchedRange);
  }, [matchedRange, setBestMatchRange]);

  const selectedDestination = useMemo(
    () => destinationOptions.find((destination) => destination.id === selectedDestinationId) ?? null,
    [destinationOptions, selectedDestinationId]
  );

  const addDestinationOption = () => {
    if (!destinationName.trim()) {
      Alert.alert('Add destination', 'Enter a destination name first.');
      return;
    }

    const optionId = `destination-${Date.now()}`;
    const nextOption: DestinationOption = {
      id: optionId,
      name: destinationName.trim(),
      country: destinationCountry.trim(),
      emoji: '✈️',
      accent: '#EEF4FF',
      votes: [],
    };

    setDestinationOptions([...destinationOptions, nextOption]);
    setDestinationName('');
    setDestinationCountry('');
  };

  const handleDestinationSelect = (destinationId: string) => {
    const actingMemberId = plannerCrew[0]?.id ?? 'self';
    setSelectedDestinationId(destinationId);
    voteDestination(destinationId, actingMemberId);
  };

  const goNext = async () => {
    if (step === 0 && activeDates.length === 0) {
      Alert.alert('Select dates', 'Choose at least one trip date before continuing.');
      return;
    }

    if (step === 1 && !selectedDestination) {
      Alert.alert('Select destination', 'Add and choose a destination before continuing.');
      return;
    }

    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }

    if (!selectedDestination || !matchedRange || activeDates.length === 0) {
      Alert.alert('Trip incomplete', 'Finish dates and destination first.');
      return;
    }

    try {
      setSaving(true);

      const created = await apiRequest<{ trip: ApiTrip }>('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: `${selectedDestination.name} Trip`,
          destination: selectedDestination.country
            ? `${selectedDestination.name}, ${selectedDestination.country}`
            : selectedDestination.name,
          start_date: `2026-04-${String(activeDates[0]).padStart(2, '0')}`,
          end_date: `2026-04-${String(activeDates[activeDates.length - 1]).padStart(2, '0')}`,
          member_ids: plannerCrew.map((member) => Number(member.id)).filter(Number.isFinite),
          lead_user_id: Number(tripLead?.id || user?.id || 0),
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

    resetPlannerState();
    navigation.goBack();
  };

  return (
    <Screen showFooter>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Create Trip"
          subtitle="Choose dates, pick a destination, assign a lead, and save the trip for your crew."
          action={<NotificationBell />}
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
                </View>
              );
            })}
          </View>
        </AppCard>

        {step === 0 ? (
          <>
            <AppCard>
              <Text style={styles.eyebrow}>Step 1</Text>
              <Text style={styles.cardTitle}>Choose dates</Text>
              <Text style={styles.cardMeta}>
                Pick the dates your crew is available. These dates are saved to the trip.
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
                      onPress={() => toggleSelectedDate(String(day))}
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
              <Text style={styles.eyebrow}>Crew on this trip</Text>
              <View style={styles.memberList}>
                {plannerCrew.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberRole}>{member.role}</Text>
                  </View>
                ))}
              </View>
            </AppCard>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <AppCard>
              <Text style={styles.eyebrow}>Step 2</Text>
              <Text style={styles.cardTitle}>Add destination options</Text>
              <Text style={styles.cardMeta}>
                Add one or more destination ideas, then choose the winner for this trip.
              </Text>

              <TextInput
                value={destinationName}
                onChangeText={setDestinationName}
                placeholder="Destination name"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <TextInput
                value={destinationCountry}
                onChangeText={setDestinationCountry}
                placeholder="Country or region"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <PrimaryButton title="Add destination option" onPress={addDestinationOption} />
            </AppCard>

            <AppCard>
              <View style={styles.destinationList}>
                {destinationOptions.length === 0 ? (
                  <Text style={styles.emptyCopy}>No destination options added yet.</Text>
                ) : (
                  destinationOptions.map((destination) => {
                    const selected = destination.id === selectedDestinationId;

                    return (
                      <Pressable
                        key={destination.id}
                        onPress={() => handleDestinationSelect(destination.id)}
                        style={[styles.destinationCard, selected && styles.destinationCardSelected]}
                      >
                        <View style={styles.destinationInfo}>
                          <Text style={styles.destinationTitle}>{destination.name}</Text>
                          <Text style={styles.destinationCountry}>
                            {destination.country || 'Country pending'}
                          </Text>
                          <Text style={styles.destinationVotes}>
                            {destination.votes.length} vote{destination.votes.length === 1 ? '' : 's'}
                          </Text>
                        </View>

                        <View style={[styles.voteIndicator, selected && styles.voteIndicatorSelected]}>
                          <Text
                            style={[
                              styles.voteIndicatorText,
                              selected && styles.voteIndicatorTextSelected,
                            ]}
                          >
                            {selected ? 'Selected' : 'Choose'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </AppCard>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <AppCard>
              <Text style={styles.eyebrow}>Step 3</Text>
              <Text style={styles.cardTitle}>Choose the trip lead</Text>
              <Text style={styles.cardMeta}>
                The trip lead owns itinerary decisions and acts as the default organizer.
              </Text>

              <View style={styles.leadGrid}>
                {plannerCrew.map((member) => {
                  const selected = member.id === tripLead?.id;

                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => setTripLead(member)}
                      style={[styles.leadCard, selected && styles.leadCardSelected]}
                    >
                      <View style={[styles.leadAvatar, selected && styles.leadAvatarSelected]}>
                        <Text
                          style={[
                            styles.leadAvatarText,
                            selected && styles.leadAvatarTextSelected,
                          ]}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <Text style={styles.leadName}>{member.name}</Text>
                      <Text style={styles.leadRole}>{member.role ?? 'Crew member'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>

            <AppCard>
              <Text style={styles.eyebrow}>Trip summary</Text>
              <Text style={styles.summaryTitle}>Ready to save</Text>
              <Text style={styles.summaryCopy}>Dates: {bestMatchRange || 'Pending'}</Text>
              <Text style={styles.summaryCopy}>
                Destination:{' '}
                {selectedDestination
                  ? selectedDestination.country
                    ? `${selectedDestination.name}, ${selectedDestination.country}`
                    : selectedDestination.name
                  : 'Pending'}
              </Text>
              <Text style={styles.summaryCopy}>Trip lead: {tripLead?.name || 'Pending'}</Text>
            </AppCard>
          </>
        ) : null}

        <View style={styles.actionRow}>
          <PrimaryButton
            title={step === 0 ? 'Back' : 'Previous'}
            variant="secondary"
            onPress={goBack}
          />
          <PrimaryButton
            title={
              saving
                ? 'Saving...'
                : step < 2
                  ? 'Continue'
                  : 'Continue to Overview'
            }
            onPress={goNext}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
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
  memberList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberRole: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  destinationList: {
    gap: spacing.sm,
  },
  emptyCopy: {
    color: colors.textSecondary,
    fontSize: 14,
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
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  summaryCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  actionRow: {
    gap: spacing.sm,
  },
});
