import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import AppFooter from '../components/AppFooter';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { DestinationOption, useTripStore } from '../store/tripStore';
import { ApiTrip, apiRequest, ensureTripCoverFromDestination } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { formatTripDate } from '../utils/tripFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'TripCreate'>;

type DateCell = {
  value: string;
  day: string;
  weekday: string;
  month: string;
  isCurrentMonth: boolean;
  isPast: boolean;
};

const steps = ['Dates', 'Destination', 'Review'];

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTripDate = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildDateCells = (visibleMonth: Date): DateCell[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(gridStart);
    next.setDate(gridStart.getDate() + index);

    return {
      value: toISODate(next),
      day: String(next.getDate()),
      weekday: next.toLocaleDateString(undefined, { weekday: 'short' }),
      month: next.getDate() === 1 ? next.toLocaleDateString(undefined, { month: 'short' }) : '',
      isCurrentMonth: next.getMonth() === visibleMonth.getMonth(),
      isPast: next < today,
    };
  });
};

const monthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const buildContinuousRange = (start: string, end: string) => {
  const firstDate = parseTripDate(start);
  const secondDate = parseTripDate(end);
  if (!firstDate || !secondDate) {
    return [];
  }

  const first = firstDate <= secondDate ? firstDate : secondDate;
  const last = firstDate <= secondDate ? secondDate : firstDate;
  const values: string[] = [];
  const cursor = new Date(first);

  while (cursor <= last) {
    values.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return values;
};

export default function TripCreateScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const crew = useTripStore((state) => state.crew);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setTripLead = useTripStore((state) => state.setTripLead);
  const setSelectedDates = useTripStore((state) => state.setSelectedDates);
  const setBestMatchRange = useTripStore((state) => state.setBestMatchRange);
  const setDestinationOptions = useTripStore((state) => state.setDestinationOptions);
  const setSelectedDestinationId = useTripStore((state) => state.setSelectedDestinationId);

  const [step, setStep] = useState(0);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const [selectedDates, updateSelectedDates] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');
  const [customRegion, setCustomRegion] = useState('');
  const [saving, setSaving] = useState(false);

  const dateCells = useMemo(() => buildDateCells(visibleMonth), [visibleMonth]);
  const firstAllowedMonth = useMemo(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  }, []);
  const selectedDestination = useMemo(
    () => ({
      id: 'custom',
      name: customName.trim(),
      region: customRegion.trim(),
    }),
    [customName, customRegion]
  );
  const canGoToPreviousMonth = visibleMonth > firstAllowedMonth;

  const travelRange = useMemo(() => {
    const active = [...selectedDates].sort((a, b) => a.localeCompare(b));
    if (active.length === 0) {
      return 'Select the trip dates';
    }
    if (active.length === 1) {
      return formatTripDate(active[0]);
    }
    return `${formatTripDate(active[0])} - ${formatTripDate(active[active.length - 1])}`;
  }, [selectedDates]);

  const handleDatePress = (value: string) => {
    const picked = parseTripDate(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!picked || picked < today) {
      return;
    }

    const active = [...selectedDates].sort((a, b) => a.localeCompare(b));

    if (active.length === 0) {
      updateSelectedDates([value]);
      return;
    }

    if (active.length === 1) {
      if (active[0] === value) {
        updateSelectedDates([]);
        return;
      }
      updateSelectedDates(buildContinuousRange(active[0], value));
      return;
    }

    updateSelectedDates([value]);
  };

  const shiftMonth = (direction: 1 | -1) => {
    setVisibleMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + direction, 1);
      return next < firstAllowedMonth ? firstAllowedMonth : next;
    });
  };

  const next = async () => {
    if (step === 0 && selectedDates.length === 0) {
      Alert.alert('Select dates', 'Choose a start day and an end day for the whole trip.');
      return;
    }

    if (step === 1 && !customName.trim()) {
      Alert.alert('Select destination', 'Choose a destination or add a custom one first.');
      return;
    }

    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }

    const sortedDates = [...selectedDates].sort((a, b) => a.localeCompare(b));
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    if (!startDate || !endDate) {
      Alert.alert('Trip incomplete', 'Add the trip dates before creating the trip.');
      return;
    }

    try {
      setSaving(true);

      const created = await apiRequest<{ trip: ApiTrip }>('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: `${selectedDestination.name} Trip`,
          destination: selectedDestination.region
            ? `${selectedDestination.name}, ${selectedDestination.region}`
            : selectedDestination.name,
          start_date: startDate,
          end_date: endDate,
          available_dates: sortedDates,
          member_ids: crew.map((member) => Number(member.id)).filter(Number.isFinite),
          lead_user_id: Number(user?.id || 0),
        }),
      });

      let createdTrip = created.trip;
      try {
        const cover = await ensureTripCoverFromDestination(created.trip.id);
        if (cover.image_url) {
          createdTrip = { ...createdTrip, image_url: cover.image_url };
        }
      } catch (coverError) {
        console.log('Destination cover generation failed', coverError);
      }

      const destinationOption: DestinationOption = {
        id: selectedDestination.id,
        name: selectedDestination.name,
        country: selectedDestination.region,
        votes: [],
      };

      setSelectedDates(sortedDates);
      setBestMatchRange(travelRange);
      setDestinationOptions([destinationOption]);
      setSelectedDestinationId(destinationOption.id);
      setCurrentTrip(createdTrip);
      setTripLead(crew[0] ?? null);
      navigation.navigate('TripOverview');
    } catch (error: any) {
      console.log('Create trip failed', error);
      Alert.alert('Trip creation failed', error?.message || 'Could not create the trip right now.');
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
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Create Trip</Text>
        </View>

        <View style={styles.stepper}>
          {steps.map((label, index) => {
            const done = index < step;
            const active = index === step;

            return (
              <View key={label} style={styles.stepperItem}>
                <View style={styles.stepperMarkerWrap}>
                  <View
                    style={[
                      styles.stepperMarker,
                      done && styles.stepperMarkerDone,
                      active && styles.stepperMarkerActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepperMarkerText,
                        (done || active) && styles.stepperMarkerTextActive,
                      ]}
                    >
                      {done ? '✓' : index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.stepperLabel, (done || active) && styles.stepperLabelActive]}>
                    {label}
                  </Text>
                </View>
                {index < steps.length - 1 ? (
                  <View style={[styles.stepperLine, done && styles.stepperLineActive]} />
                ) : null}
              </View>
            );
          })}
        </View>

        {step === 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select the trip dates</Text>
            <Text style={styles.sectionMeta}>Pick the dates for the whole trip once, without individual availability collection.</Text>

            <View style={styles.monthHeader}>
              <Pressable
                onPress={() => shiftMonth(-1)}
                disabled={!canGoToPreviousMonth}
                style={[styles.monthButton, !canGoToPreviousMonth && styles.monthButtonDisabled]}
              >
                <Ionicons name="chevron-back" size={18} color={canGoToPreviousMonth ? colors.textPrimary : colors.textMuted} />
              </Pressable>
              <Text style={styles.monthTitle}>{monthLabel(visibleMonth)}</Text>
              <Pressable onPress={() => shiftMonth(1)} style={styles.monthButton}>
                <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {dateCells.map((cell) => {
                const isSelected = selectedDates.includes(cell.value);
                return (
                  <Pressable
                    key={cell.value}
                    disabled={cell.isPast}
                    onPress={() => handleDatePress(cell.value)}
                    style={[
                      styles.dayButton,
                      !cell.isCurrentMonth && styles.dayButtonOutsideMonth,
                      cell.isPast && styles.dayButtonDisabled,
                      isSelected && styles.dayButtonSelected,
                    ]}
                  >
                    <Text style={[styles.dayButtonText, !cell.isCurrentMonth && styles.outsideMonthText, cell.isPast && styles.disabledDayText, isSelected && styles.dayButtonTextSelected]}>{cell.day}</Text>
                    <Text style={[styles.dayButtonMeta, !cell.isCurrentMonth && styles.outsideMonthText, cell.isPast && styles.disabledDayText, isSelected && styles.dayButtonTextSelected]}>
                      {cell.weekday}
                    </Text>
                    <Text style={[styles.dayButtonMonth, !cell.isCurrentMonth && styles.outsideMonthText, cell.isPast && styles.disabledDayText, isSelected && styles.dayButtonTextSelected]}>
                      {cell.month || ' '}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Trip dates</Text>
              <Text style={styles.summaryTitle}>{travelRange}</Text>
              <Text style={styles.summaryMeta}>
                {selectedDates.length <= 1
                  ? 'Tap the first day, then the last day.'
                  : `${selectedDates.length} days selected for the whole crew.`}
              </Text>
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose the destination</Text>
            <Text style={styles.sectionMeta}>Type the exact destination. The trip cover will be fetched and saved after the trip is created.</Text>

            <View style={styles.customDestinationCard}>
              <Text style={styles.customTitle}>Destination</Text>
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                placeholder="City, place, or area"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <TextInput
                value={customRegion}
                onChangeText={setCustomRegion}
                placeholder="Country or region"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            </View>

            {customName.trim() ? (
              <View style={styles.destinationPreviewCard}>
                <View style={styles.destinationPreviewIcon}>
                  <Ionicons name="location-outline" size={18} color={colors.accent} />
                </View>
                <View style={styles.destinationPreviewCopy}>
                  <Text style={styles.destinationPreviewTitle}>{customName.trim()}</Text>
                  <Text style={styles.destinationPreviewMeta}>{customRegion.trim() || 'Region not specified'}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Review your trip</Text>
            <Text style={styles.sectionMeta}>This is the final trip setup before you create the crew’s trip space.</Text>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Trip dates</Text>
              <Text style={styles.reviewValue}>{travelRange}</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Destination</Text>
              <Text style={styles.reviewValue}>
                {selectedDestination.region
                  ? `${selectedDestination.name}, ${selectedDestination.region}`
                  : selectedDestination.name}
              </Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Trip lead</Text>
              <Text style={styles.reviewValue}>{crew[0]?.name || user?.name || user?.email || 'You'}</Text>
              <Text style={styles.reviewMeta}>The trip creator becomes the lead to keep the flow simple.</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Crew</Text>
              <Text style={styles.reviewValue}>{crew.length} members</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={next} style={styles.ctaButton}>
          <Text style={styles.ctaText}>{saving ? 'Creating...' : step < 2 ? 'Continue' : 'Create Trip'}</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
      <AppFooter />
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
    paddingTop: 56,
    paddingBottom: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  stepperItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperMarkerWrap: {
    alignItems: 'center',
    gap: 8,
  },
  stepperMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperMarkerActive: {
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  stepperMarkerDone: {
    backgroundColor: colors.accent,
  },
  stepperMarkerText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  stepperMarkerTextActive: {
    color: '#FFFFFF',
  },
  stepperLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  stepperLabelActive: {
    color: colors.accent,
  },
  stepperLine: {
    flex: 1,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginHorizontal: 8,
    marginBottom: 18,
  },
  stepperLineActive: {
    backgroundColor: colors.accent,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionMeta: {
    marginTop: -6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  monthTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonDisabled: {
    opacity: 0.45,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  weekdayLabel: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayButton: {
    width: '13.95%',
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayButtonSelected: {
    backgroundColor: colors.accent,
  },
  dayButtonOutsideMonth: {
    opacity: 0.42,
  },
  dayButtonDisabled: {
    opacity: 0.28,
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayButtonMeta: {
    marginTop: 2,
    fontSize: 9,
    color: colors.textMuted,
  },
  dayButtonMonth: {
    marginTop: 1,
    fontSize: 9,
    color: colors.textMuted,
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  outsideMonthText: {
    color: colors.textMuted,
  },
  disabledDayText: {
    color: colors.textMuted,
  },
  summaryBox: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  summaryTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summaryMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  destinationList: {
    gap: spacing.md,
  },
  destinationCard: {
    height: 132,
    borderRadius: 18,
    overflow: 'hidden',
  },
  destinationCardSelected: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  destinationImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  destinationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.34)',
  },
  destinationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  destinationTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  destinationRegion: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
  },
  selectedBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customDestinationCard: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  customTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  input: {
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 14,
  },
  destinationPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#C7DAFF',
    padding: spacing.lg,
  },
  destinationPreviewIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationPreviewCopy: {
    flex: 1,
  },
  destinationPreviewTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  destinationPreviewMeta: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
  },
  reviewCard: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  reviewValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  reviewMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 84,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingVertical: 18,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
