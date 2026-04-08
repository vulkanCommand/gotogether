import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {
  ItineraryDay,
  ItineraryEventStatus,
  useTripStore,
} from '../store/tripStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Itinerary'>;

const formatFallbackDateLabel = (index: number) => {
  const labels = ['Friday, May 24', 'Saturday, May 25', 'Sunday, May 26', 'Monday, May 27'];
  return labels[index] ?? `Day ${index + 1} schedule`;
};

const buildDefaultDays = (tripTitle: string): ItineraryDay[] => [
  {
    id: 'day-1',
    title: 'Day 1',
    dateLabel: formatFallbackDateLabel(0),
    events: [
      {
        id: '1',
        time: '10:30 AM',
        title: `Arrival breakfast stop`,
        location: 'Crew meetup point',
        notes: `Quick coffee, snacks, and a final plan check before heading into ${tripTitle}.`,
        attendees: ['4 attending'],
        status: 'completed',
      },
      {
        id: '2',
        time: '4:30 PM',
        title: 'Check-in and reset',
        location: 'Stay check-in',
        notes: 'Unload bags, assign rooms, and lock the dinner plan for the evening.',
        attendees: ['4 attending'],
        status: 'active',
      },
      {
        id: '3',
        time: '7:15 PM',
        title: 'Sunset dinner with the crew',
        location: 'Dinner reservation',
        notes: 'Table is reserved. Final headcount is still pending from one person.',
        attendees: ['3 confirmed • 1 pending'],
        status: 'upcoming',
      },
    ],
  },
  {
    id: 'day-2',
    title: 'Day 2',
    dateLabel: formatFallbackDateLabel(1),
    events: [
      {
        id: '4',
        time: '8:00 AM',
        title: 'Coffee and breakfast',
        location: 'Stay lobby or kitchen',
        notes: 'Easy breakfast before the main daytime activity starts.',
        attendees: ['4 attending'],
        status: 'upcoming',
      },
      {
        id: '5',
        time: '10:00 AM',
        title: `${tripTitle} main activity block`,
        location: 'Planned group activity',
        notes: 'This is the biggest shared plan of the day and should stay anchored.',
        attendees: ['4 attending'],
        status: 'upcoming',
      },
      {
        id: '6',
        time: '6:30 PM',
        title: 'Group dinner and recap',
        location: 'Dinner spot',
        notes: 'Dinner booking stays flexible depending on energy level after the day plan.',
        attendees: ['4 attending'],
        status: 'upcoming',
      },
    ],
  },
];

export default function ItineraryScreen({ navigation }: Props) {
  const bestMatchRange = useTripStore((state) => state.bestMatchRange);
  const selectedDates = useTripStore((state) => state.selectedDates);
  const crew = useTripStore((state) => state.crew);
  const tripLead = useTripStore((state) => state.tripLead);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const setItineraryDays = useTripStore((state) => state.setItineraryDays);
  const addDay = useTripStore((state) => state.addDay);
  const addEventToDay = useTripStore((state) => state.addEventToDay);
  const selectedDestination = useTripStore((state) => state.selectedDestination);
  const totalPlans = useTripStore((state) => state.totalPlans);
  const totalConfirmedPlans = useTripStore((state) => state.totalConfirmedPlans);
  const nextUp = useTripStore((state) => state.nextUp);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<string>('day-1');

  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newAttendees, setNewAttendees] = useState('');
  const [newStatus, setNewStatus] = useState<ItineraryEventStatus>('upcoming');

  const destination = selectedDestination();
  const tripTitle = destination?.name ?? 'Your Trip';
  const crewCount = crew.length > 0 ? crew.length : 4;
  const leadName = tripLead?.name ?? 'Trip lead pending';
  const computedNextUp = nextUp();

  const sortedSelectedDates = useMemo(() => {
    const numeric = selectedDates
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b);

    return numeric;
  }, [selectedDates]);

  useEffect(() => {
    if (itineraryDays.length === 0) {
      setItineraryDays(buildDefaultDays(tripTitle));
    }
  }, [itineraryDays.length, setItineraryDays, tripTitle]);

  useEffect(() => {
    if (itineraryDays.length > 0 && !itineraryDays.some((day) => day.id === selectedDayId)) {
      setSelectedDayId(itineraryDays[0].id);
    }
  }, [itineraryDays, selectedDayId]);

  const tripMeta = [
    bestMatchRange || 'Dates pending',
    destination?.country ? `${destination.name}, ${destination.country}` : destination?.name ?? 'Destination pending',
  ].join(' • ');

  const resetForm = () => {
    setNewTitle('');
    setNewTime('');
    setNewLocation('');
    setNewNote('');
    setNewAttendees('');
    setNewStatus('upcoming');
  };

  const openAddPlanModal = (dayId: string) => {
    setSelectedDayId(dayId);
    resetForm();
    setModalVisible(true);
  };

  const handleAddPlan = () => {
    if (!newTitle.trim() || !newTime.trim()) {
      return;
    }

    addEventToDay(selectedDayId, {
      id: `event-${Date.now()}`,
      title: newTitle.trim(),
      time: newTime.trim(),
      location: newLocation.trim() || 'Location TBD',
      notes: newNote.trim() || 'No notes added yet.',
      attendees: [newAttendees.trim() || `${crewCount} attending`],
      status: newStatus,
    });

    setModalVisible(false);
    resetForm();
  };

  const handleAddDay = () => {
    const nextIndex = itineraryDays.length;
    const matchedDayNumber = sortedSelectedDates[nextIndex];
    const fallbackDateLabel = matchedDayNumber
      ? `April ${matchedDayNumber}`
      : formatFallbackDateLabel(nextIndex);

    addDay({
      id: `day-${Date.now()}`,
      title: `Day ${nextIndex + 1}`,
      dateLabel: fallbackDateLabel,
      events: [],
    });
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SectionTitle
          title="Itinerary"
          subtitle="Build the day-by-day plan, keep the next move visible, and carry the trip flow into expenses."
        />

        <AppCard>
          <View style={styles.headerTop}>
            <View style={styles.headerInfo}>
              <Text style={styles.tripTitle}>{tripTitle}</Text>
              <Text style={styles.tripMeta}>{tripMeta}</Text>
            </View>

            <View style={styles.readyPill}>
              <Text style={styles.readyPillText}>Live plan</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryPill value={`${itineraryDays.length} days`} />
            <SummaryPill value={`${totalPlans()} plans`} />
            <SummaryPill value={`${totalConfirmedPlans()} confirmed`} />
          </View>

          <View style={styles.nextCard}>
            <Text style={styles.nextEyebrow}>Next up</Text>

            <View style={styles.nextHeaderRow}>
              <Text style={styles.nextTitle}>{computedNextUp.title}</Text>
              <Text style={styles.nextTime}>
                {computedNextUp.day} • {computedNextUp.time}
              </Text>
            </View>

            <Text style={styles.nextMeta}>{computedNextUp.meta}</Text>
          </View>

          <View style={styles.contextRow}>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Trip lead</Text>
              <Text style={styles.contextValue}>{leadName}</Text>
            </View>

            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Crew</Text>
              <Text style={styles.contextValue}>{crewCount} people</Text>
            </View>
          </View>
        </AppCard>

        <View style={styles.utilityActions}>
          <PrimaryButton title="Add Day" variant="secondary" onPress={handleAddDay} />
        </View>

        <View style={styles.dayList}>
          {itineraryDays.map((day) => (
            <AppCard key={day.id}>
              <View style={styles.dayHeader}>
                <View style={styles.dayTitleWrap}>
                  <Text style={styles.dayLabel}>{day.title}</Text>
                  <Text style={styles.dayDate}>{day.dateLabel}</Text>
                </View>

                <View style={styles.dayHeaderRight}>
                  <View style={styles.focusBadge}>
                    <Text style={styles.focusBadgeText}>
                      {day.events.length > 0 ? `${day.events.length} plans` : 'Plans coming together'}
                    </Text>
                  </View>

                  <View style={styles.dayAddButton}>
                    <PrimaryButton
                      title="Add Plan"
                      variant="secondary"
                      onPress={() => openAddPlanModal(day.id)}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.timeline}>
                {day.events.length > 0 ? (
                  day.events.map((plan, index) => (
                    <PlanRow
                      key={plan.id}
                      plan={{
                        id: plan.id,
                        time: plan.time,
                        title: plan.title,
                        location: plan.location,
                        note: plan.notes,
                        attendees: plan.attendees.join(', '),
                        status: plan.status,
                      }}
                      isLast={index === day.events.length - 1}
                    />
                  ))
                ) : (
                  <View style={styles.emptyPlanCard}>
                    <Text style={styles.emptyPlanTitle}>No plans yet</Text>
                    <Text style={styles.emptyPlanMeta}>
                      Add the first event for this day to start building the itinerary.
                    </Text>
                  </View>
                )}
              </View>
            </AppCard>
          ))}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title="Add Expense"
            onPress={() => navigation.navigate('AddExpense')}
          />
          <PrimaryButton
            title="Finish Trip Flow"
            variant="secondary"
            onPress={() => navigation.navigate('TripCompletion')}
          />
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add itinerary event</Text>
            <Text style={styles.modalSubtitle}>
              Create a new plan for the selected day and keep the trip flow moving.
            </Text>

            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Event title"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />

            <TextInput
              value={newTime}
              onChangeText={setNewTime}
              placeholder="Time, for example 4:30 PM"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />

            <TextInput
              value={newLocation}
              onChangeText={setNewLocation}
              placeholder="Location"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />

            <TextInput
              value={newAttendees}
              onChangeText={setNewAttendees}
              placeholder="Attendees, for example 4 attending"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />

            <TextInput
              value={newNote}
              onChangeText={setNewNote}
              placeholder="Notes"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.notesInput]}
              multiline
            />

            <Text style={styles.statusLabel}>Status</Text>
            <View style={styles.statusOptions}>
              {(['upcoming', 'active', 'completed'] as ItineraryEventStatus[]).map((status) => {
                const selected = newStatus === status;

                return (
                  <Pressable
                    key={status}
                    onPress={() => setNewStatus(status)}
                    style={[
                      styles.statusOption,
                      selected && styles.statusOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        selected && styles.statusOptionTextSelected,
                      ]}
                    >
                      {status}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <PrimaryButton title="Save Plan" onPress={handleAddPlan} />
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={() => setModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SummaryPill({ value }: { value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryPillText}>{value}</Text>
    </View>
  );
}

function PlanRow({
  plan,
  isLast,
}: {
  plan: {
    id: string;
    time: string;
    title: string;
    location: string;
    note: string;
    attendees: string;
    status: ItineraryEventStatus;
  };
  isLast: boolean;
}) {
  const markerStyle =
    plan.status === 'completed'
      ? styles.markerCompleted
      : plan.status === 'active'
      ? styles.markerActive
      : styles.markerUpcoming;

  const titleStyle =
    plan.status === 'completed' ? styles.planTitleCompleted : null;

  const statusText =
    plan.status === 'completed'
      ? 'Completed'
      : plan.status === 'active'
      ? 'Happening now'
      : 'Upcoming';

  const statusPillStyle =
    plan.status === 'completed'
      ? styles.statusCompleted
      : plan.status === 'active'
      ? styles.statusActive
      : styles.statusUpcoming;

  const statusTextStyle =
    plan.status === 'completed'
      ? styles.statusCompletedText
      : plan.status === 'active'
      ? styles.statusActiveText
      : styles.statusUpcomingText;

  return (
    <View style={styles.planRow}>
      <View style={styles.leftRail}>
        <Text style={styles.time}>{plan.time}</Text>
        <View style={[styles.marker, markerStyle]} />
        {!isLast && <View style={styles.railLine} />}
      </View>

      <View style={styles.planCard}>
        <View style={styles.planTop}>
          <Text style={[styles.planTitle, titleStyle]}>{plan.title}</Text>

          <View style={[styles.statusPill, statusPillStyle]}>
            <Text style={[styles.statusPillText, statusTextStyle]}>
              {statusText}
            </Text>
          </View>
        </View>

        <Text style={styles.planLocation}>{plan.location}</Text>
        <Text style={styles.planNote}>{plan.note}</Text>

        <View style={styles.planFooter}>
          <Text style={styles.planAttendees}>{plan.attendees}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  tripTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tripMeta: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
  },
  readyPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  readyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nextCard: {
    marginTop: spacing.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  nextEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  nextHeaderRow: {
    marginTop: 8,
    gap: 6,
  },
  nextTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  nextTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  nextMeta: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
  },
  contextRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contextCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  contextValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  utilityActions: {
    gap: spacing.sm,
  },
  dayList: {
    gap: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dayTitleWrap: {
    flex: 1,
  },
  dayHeaderRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  dayAddButton: {
    minWidth: 120,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dayDate: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  focusBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  focusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  timeline: {
    gap: spacing.md,
  },
  emptyPlanCard: {
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: '#F8FAFC',
  },
  emptyPlanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyPlanMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  leftRail: {
    width: 74,
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 10,
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  markerCompleted: {
    backgroundColor: colors.success,
    borderColor: '#D1FAE5',
  },
  markerActive: {
    backgroundColor: colors.accent,
    borderColor: '#DBEAFE',
  },
  markerUpcoming: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  railLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 8,
    borderRadius: radius.pill,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  planTop: {
    gap: 10,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  planTitleCompleted: {
    opacity: 0.6,
    textDecorationLine: 'line-through',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusCompleted: {
    backgroundColor: '#EAF8EE',
  },
  statusActive: {
    backgroundColor: '#E8F0FF',
  },
  statusUpcoming: {
    backgroundColor: '#F3F4F6',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusCompletedText: {
    color: '#1F8A4C',
  },
  statusActiveText: {
    color: colors.accent,
  },
  statusUpcomingText: {
    color: colors.textSecondary,
  },
  planLocation: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  planNote: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  planFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  planAttendees: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  statusLabel: {
    marginTop: spacing.xs,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: '#F3F4F6',
  },
  statusOptionSelected: {
    backgroundColor: '#EEF2FF',
  },
  statusOptionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusOptionTextSelected: {
    color: colors.accent,
  },
  modalActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});