import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { ItineraryDay, ItineraryEventStatus, useTripStore } from '../store/tripStore';
import { apiRequest } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Itinerary'>;

const fallbackDateLabel = (index: number) => {
  const labels = ['Day one', 'Day two', 'Day three', 'Day four'];
  return labels[index] ?? `Day ${index + 1}`;
};

const parseNumericId = (value: string) => value.replace(/^(day|event)-/, '');

const parseTime = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  return {
    hour: match?.[1] || '9',
    minute: match?.[2] || '00',
    period: (match?.[3] || 'AM').toUpperCase(),
  };
};

const timeHours = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const timeMinutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const timePeriods = ['AM', 'PM'];

export default function ItineraryScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const bestMatchRange = useTripStore((state) => state.bestMatchRange);
  const selectedDates = useTripStore((state) => state.selectedDates);
  const crew = useTripStore((state) => state.crew);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const setItineraryDays = useTripStore((state) => state.setItineraryDays);
  const selectedDestination = useTripStore((state) => state.selectedDestination);

  const [loading, setLoading] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<ItineraryEventStatus>('upcoming');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('9:00 AM');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [locationStatus, setLocationStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const destination = selectedDestination();
  const tripTitle = currentTrip?.name ?? destination?.name ?? 'Your Trip';
  const tripMeta = [
    bestMatchRange || 'Dates pending',
    currentTrip?.destination ??
      (destination?.country ? `${destination.name}, ${destination.country}` : destination?.name ?? 'Destination pending'),
  ].join(' - ');
  const canManageItinerary = currentTrip?.viewer_role === 'lead';

  const sortedSelectedDates = useMemo(() => {
    return selectedDates
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b);
  }, [selectedDates]);

  const totals = useMemo(() => {
    const events = itineraryDays.flatMap((day) => day.events);
    return {
      days: itineraryDays.length,
      plans: events.length,
      done: events.filter((event) => event.status === 'completed').length,
    };
  }, [itineraryDays]);

  const fetchItinerary = useCallback(async () => {
    if (!currentTrip?.id) {
      setItineraryDays([]);
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest<{ days: ItineraryDay[] }>(`/api/trips/${currentTrip.id}/itinerary`);
      setItineraryDays(Array.isArray(data.days) ? data.days : []);
    } catch (error) {
      console.log('Fetch itinerary failed', error);
      setItineraryDays([]);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id, setItineraryDays]);

  useEffect(() => {
    fetchItinerary();
  }, [fetchItinerary]);

  useFocusEffect(
    useCallback(() => {
      fetchItinerary();
    }, [fetchItinerary])
  );

  useEffect(() => {
    if (itineraryDays.length > 0 && !itineraryDays.some((day) => day.id === selectedDayId)) {
      setSelectedDayId(itineraryDays[0].id);
    }
  }, [itineraryDays, selectedDayId]);

  const resetForm = () => {
    setTitle('');
    setTime('9:00 AM');
    setLocation('');
    setNotes('');
    setFormStatus('upcoming');
    setSelectedAttendeeIds(crew.map((member) => member.id));
    setLocationStatus('');
  };

  const selectedAttendeeNames = () => {
    const selected = crew.filter((member) => selectedAttendeeIds.includes(member.id)).map((member) => member.name);
    return selected.length > 0 ? selected : crew.map((member) => member.name);
  };

  const openAddPlan = (dayId: string) => {
    setSelectedDayId(dayId);
    setEditingEventId(null);
    resetForm();
    setEventModalVisible(true);
  };

  const openEditPlan = (dayId: string, eventId: string) => {
    const event = itineraryDays.find((day) => day.id === dayId)?.events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }

    setSelectedDayId(dayId);
    setEditingEventId(eventId);
    setFormStatus(event.status);
    setTitle(event.title);
    setTime(event.time);
    setLocation(event.location);
    setNotes(event.notes);
    setSelectedAttendeeIds(crew.filter((member) => event.attendees.includes(member.name)).map((member) => member.id));
    setLocationStatus('');
    setEventModalVisible(true);
  };

  const handleAddDay = async () => {
    if (!currentTrip?.id) {
      return;
    }

    const nextIndex = itineraryDays.length;
    const matchedDayNumber = sortedSelectedDates[nextIndex];
    const dateLabel = matchedDayNumber ? `April ${matchedDayNumber}` : fallbackDateLabel(nextIndex);

    try {
      await apiRequest(`/api/trips/${currentTrip.id}/itinerary/days`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Day ${nextIndex + 1}`,
          dateLabel,
        }),
      });
      await fetchItinerary();
    } catch (error: any) {
      Alert.alert('Day failed', error?.message || 'Could not add day');
    }
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!currentTrip?.id) {
      return;
    }

    Alert.alert('Delete day', 'This removes the day and all events inside it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/api/trips/${currentTrip.id}/itinerary/days/${dayId}`, { method: 'DELETE' });
            await fetchItinerary();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete day');
          }
        },
      },
    ]);
  };

  const validateLocation = async () => {
    if (!location.trim()) {
      setLocationStatus('Add a location first.');
      return;
    }

    try {
      const matches = await Location.geocodeAsync(location.trim());
      setLocationStatus(matches.length > 0 ? 'Map location found.' : 'No map result. Saved as text.');
    } catch {
      setLocationStatus('No map result. Saved as text.');
    }
  };

  const handleSavePlan = async () => {
    if (!currentTrip?.id || !selectedDayId) {
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title needed', 'Add a title for this event.');
      return;
    }

    const payload = {
      title: title.trim(),
      time,
      location: location.trim() || 'Location TBD',
      notes: notes.trim() || 'No notes added yet.',
      attendees: selectedAttendeeNames(),
      status: formStatus,
    };

    try {
      setSaving(true);
      if (editingEventId) {
        await apiRequest(`/api/trips/${currentTrip.id}/itinerary/events/${parseNumericId(editingEventId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/api/trips/${currentTrip.id}/itinerary/days/${parseNumericId(selectedDayId)}/events`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      await fetchItinerary();
      setEventModalVisible(false);
      setEditingEventId(null);
      resetForm();
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      await apiRequest(`/api/trips/${currentTrip.id}/itinerary/events/${parseNumericId(eventId)}`, { method: 'DELETE' });
      await fetchItinerary();
    } catch (error: any) {
      Alert.alert('Delete failed', error?.message || 'Could not delete event');
    }
  };

  const handleCompleteEvent = async (eventId: string) => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      const response = await apiRequest<{ days: ItineraryDay[] }>(
        `/api/trips/${currentTrip.id}/itinerary/events/${parseNumericId(eventId)}/complete`,
        { method: 'POST' }
      );
      setItineraryDays(response.days);
      Alert.alert('Confirmation sent', 'Crew members will confirm this event from Pending tasks.');
    } catch (error: any) {
      Alert.alert('Complete failed', error?.message || 'Could not complete event');
    }
  };

  const handleUndoCompleteEvent = async (eventId: string) => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      const response = await apiRequest<{ days: ItineraryDay[] }>(
        `/api/trips/${currentTrip.id}/itinerary/events/${parseNumericId(eventId)}/undo-complete`,
        { method: 'POST' }
      );
      setItineraryDays(response.days);
    } catch (error: any) {
      Alert.alert('Undo failed', error?.message || 'Could not reopen event');
    }
  };

  const toggleAttendee = (memberId: string) => {
    setSelectedAttendeeIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  };

  const setTimePart = (part: 'hour' | 'minute' | 'period', value: string) => {
    const current = parseTime(time);
    setTime(`${part === 'hour' ? value : current.hour}:${part === 'minute' ? value : current.minute} ${part === 'period' ? value : current.period}`);
  };

  const selectedTime = parseTime(time);

  return (
    <Screen scroll={false} showFooter>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionTitle
          title="Itinerary"
          subtitle="A clean day-by-day plan for the crew."
          action={<NotificationBell />}
        />

        <AppCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>Trip plan</Text>
              <Text style={styles.tripTitle}>{tripTitle}</Text>
              <Text style={styles.tripMeta}>{tripMeta}</Text>
            </View>
            <Pressable style={styles.detailsButton} onPress={() => navigation.navigate('TripOverview')}>
              <Text style={styles.detailsButtonText}>View details</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <MiniStat label="Days" value={String(totals.days)} />
            <MiniStat label="Events" value={String(totals.plans)} />
            <MiniStat label="Done" value={`${totals.done}/${totals.plans}`} />
          </View>
        </AppCard>

        {canManageItinerary ? (
          <View style={styles.topActions}>
            <PrimaryButton title="Add Day" variant="secondary" onPress={handleAddDay} />
          </View>
        ) : null}

        {loading ? (
          <AppCard>
            <Text style={styles.emptyTitle}>Loading itinerary...</Text>
          </AppCard>
        ) : null}

        {!loading && itineraryDays.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No itinerary days yet</Text>
            <Text style={styles.emptyText}>Add a day, then add events in the order the crew should follow.</Text>
            {canManageItinerary ? (
              <View style={styles.emptyAction}>
                <PrimaryButton title="Add First Day" onPress={handleAddDay} />
              </View>
            ) : null}
          </AppCard>
        ) : null}

        <View style={styles.dayList}>
          {itineraryDays.map((day, dayIndex) => (
            <AppCard key={day.id} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View>
                  <Text style={styles.dayNumber}>Day {dayIndex + 1}</Text>
                  <Text style={styles.dayTitle}>{day.title}</Text>
                  <Text style={styles.dayDate}>{day.dateLabel}</Text>
                </View>
                <View style={styles.dayActions}>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{day.events.length} events</Text>
                  </View>
                  {canManageItinerary ? (
                    <Pressable style={styles.iconButton} onPress={() => openAddPlan(day.id)}>
                      <Text style={styles.iconButtonText}>+ Event</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.eventList}>
                {day.events.length === 0 ? (
                  <View style={styles.emptyEvent}>
                    <Text style={styles.emptyTitle}>No events yet</Text>
                    <Text style={styles.emptyText}>Events will appear here in the exact order they happen.</Text>
                  </View>
                ) : (
                  day.events.map((event, eventIndex) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      isLast={eventIndex === day.events.length - 1}
                      canManage={canManageItinerary}
                      onEdit={() => openEditPlan(day.id, event.id)}
                      onDelete={() => handleDeleteEvent(event.id)}
                      onComplete={() => handleCompleteEvent(event.id)}
                      onUndo={() => handleUndoCompleteEvent(event.id)}
                    />
                  ))
                )}
              </View>

              {canManageItinerary ? (
                <Pressable style={styles.deleteDayButton} onPress={() => handleDeleteDay(day.id)}>
                  <Text style={styles.deleteDayText}>Delete day</Text>
                </Pressable>
              ) : null}
            </AppCard>
          ))}
        </View>

        <View style={styles.bottomActions}>
          <PrimaryButton title="Add Expense" onPress={() => navigation.navigate('AddExpense')} />
          <PrimaryButton title="Finish Trip Flow" variant="secondary" onPress={() => navigation.navigate('TripCompletion')} />
        </View>
      </ScrollView>

      <Modal visible={eventModalVisible} transparent animationType="slide" onRequestClose={() => setEventModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.eventSheet}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.eventSheetContent}>
              <Text style={styles.modalTitle}>{editingEventId ? 'Edit event' : 'Add event'}</Text>
              <Text style={styles.modalSubtitle}>Add the next step in the trip plan. Status is handled automatically.</Text>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Event title"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Pressable style={styles.timeField} onPress={() => setTimeModalVisible(true)}>
                <View>
                  <Text style={styles.fieldLabel}>Time</Text>
                  <Text style={styles.timeValue}>{time}</Text>
                </View>
                <Text style={styles.chevron}>Change</Text>
              </Pressable>

              <TextInput
                value={location}
                onChangeText={setLocation}
                onBlur={validateLocation}
                placeholder="Location"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />
              <Pressable style={styles.softChip} onPress={validateLocation}>
                <Text style={styles.softChipText}>Check map location</Text>
              </Pressable>
              {locationStatus ? <Text style={styles.locationStatus}>{locationStatus}</Text> : null}

              <View style={styles.attendeeHeader}>
                <Text style={styles.fieldLabel}>Attendees</Text>
                <Pressable onPress={() => setSelectedAttendeeIds(crew.map((member) => member.id))}>
                  <Text style={styles.selectAllText}>Select all</Text>
                </Pressable>
              </View>

              <View style={styles.attendeeGrid}>
                {crew.map((member) => {
                  const selected = selectedAttendeeIds.includes(member.id);
                  return (
                    <Pressable
                      key={member.id}
                      style={[styles.attendeeChip, selected && styles.attendeeChipSelected]}
                      onPress={() => toggleAttendee(member.id)}
                    >
                      <Text style={[styles.attendeeText, selected && styles.attendeeTextSelected]}>{member.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.notesInput]}
                multiline
              />

              <View style={styles.modalActions}>
                <PrimaryButton title={saving ? 'Saving...' : 'Save Event'} onPress={handleSavePlan} disabled={saving} />
                <PrimaryButton title="Cancel" variant="secondary" onPress={() => setEventModalVisible(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={timeModalVisible} transparent animationType="fade" onRequestClose={() => setTimeModalVisible(false)}>
        <View style={styles.timeOverlay}>
          <View style={styles.timeSheet}>
            <Text style={styles.modalTitle}>Select time</Text>
            <View style={styles.timeWheelWrap}>
              <TimeWheel values={timeHours} selected={selectedTime.hour} onSelect={(value) => setTimePart('hour', value)} />
              <TimeWheel values={timeMinutes} selected={selectedTime.minute} onSelect={(value) => setTimePart('minute', value)} />
              <TimeWheel values={timePeriods} selected={selectedTime.period} onSelect={(value) => setTimePart('period', value)} />
            </View>
            <View style={styles.modalActions}>
              <PrimaryButton title="Use Time" onPress={() => setTimeModalVisible(false)} />
              <PrimaryButton title="Cancel" variant="secondary" onPress={() => setTimeModalVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function TimeWheel({
  values,
  selected,
  onSelect,
}: {
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <ScrollView style={styles.timeWheel} showsVerticalScrollIndicator={false} contentContainerStyle={styles.timeWheelContent}>
      {values.map((value) => {
        const active = value === selected;
        return (
          <Pressable key={value} style={[styles.timeWheelItem, active && styles.timeWheelItemActive]} onPress={() => onSelect(value)}>
            <Text style={[styles.timeWheelText, active && styles.timeWheelTextActive]}>{value}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function EventRow({
  event,
  isLast,
  canManage,
  onEdit,
  onDelete,
  onComplete,
  onUndo,
}: {
  event: ItineraryDay['events'][number];
  isLast: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onUndo: () => void;
}) {
  const isCompleted = event.status === 'completed';
  const isActive = event.status === 'active';

  return (
    <View style={styles.eventRow}>
      <View style={styles.timelineRail}>
        <Text style={styles.eventTime}>{event.time}</Text>
        <View style={[styles.timelineDot, isCompleted && styles.timelineDotDone, isActive && styles.timelineDotActive]} />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>

      <View style={[styles.eventCard, isActive && styles.eventCardActive]}>
        {isActive ? <Text style={styles.nowLabel}>Active now</Text> : null}
        <Text style={[styles.eventTitle, isCompleted && styles.eventTitleDone]}>{event.title}</Text>
        <Text style={styles.eventLocation}>{event.location}</Text>
        <Text style={styles.eventNotes}>{event.notes}</Text>
        <Text style={styles.eventAttendees}>{event.attendees.join(', ') || 'Crew pending'}</Text>

        {canManage ? (
          <View style={styles.eventActions}>
            <Pressable style={styles.eventAction} onPress={isCompleted ? onUndo : onComplete}>
              <Text style={styles.eventActionText}>{isCompleted ? 'Undo' : 'Complete'}</Text>
            </Pressable>
            <Pressable style={styles.eventAction} onPress={onEdit}>
              <Text style={styles.eventActionText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.eventDeleteAction} onPress={onDelete}>
              <Text style={styles.eventDeleteText}>Delete</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tripTitle: {
    marginTop: 6,
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  tripMeta: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  detailsButton: {
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  miniStat: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#EAF0F8',
    backgroundColor: '#F8FAFC',
    padding: spacing.md,
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  miniStatLabel: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  topActions: {
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: 'flex-start',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyAction: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  dayList: {
    gap: spacing.md,
  },
  dayCard: {
    padding: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dayNumber: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dayTitle: {
    marginTop: 5,
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '900',
  },
  dayDate: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 13,
  },
  dayActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  countPill: {
    borderRadius: radius.pill,
    backgroundColor: '#F3F6FB',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  iconButton: {
    borderRadius: radius.pill,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  iconButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  eventList: {
    gap: spacing.md,
  },
  emptyEvent: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#EAF0F8',
    backgroundColor: '#F8FAFC',
    padding: spacing.md,
  },
  deleteDayButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: 6,
  },
  deleteDayText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  eventRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineRail: {
    width: 68,
    alignItems: 'center',
  },
  eventTime: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  timelineDotActive: {
    borderColor: '#DBEAFE',
    backgroundColor: colors.accent,
  },
  timelineDotDone: {
    borderColor: '#D1FAE5',
    backgroundColor: colors.success,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5EAF2',
    marginTop: 8,
    borderRadius: radius.pill,
  },
  eventCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#EAF0F8',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
  },
  eventCardActive: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F7FBFF',
  },
  nowLabel: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: radius.pill,
    backgroundColor: '#DBEAFE',
    color: colors.accent,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '900',
  },
  eventTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  eventTitleDone: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  eventLocation: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  eventNotes: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  eventAttendees: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  eventActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  eventAction: {
    borderRadius: radius.pill,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  eventActionText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  eventDeleteAction: {
    borderRadius: radius.pill,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  eventDeleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  bottomActions: {
    gap: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  eventSheet: {
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  eventSheetContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E3EAF4',
    backgroundColor: '#FFFFFF',
    color: colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  timeField: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E3EAF4',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timeValue: {
    marginTop: 5,
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  chevron: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  softChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  softChipText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  locationStatus: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  attendeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  selectAllText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  attendeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  attendeeChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#E3EAF4',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  attendeeChipSelected: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EEF4FF',
  },
  attendeeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  attendeeTextSelected: {
    color: colors.accent,
  },
  notesInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  modalActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  timeOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  timeSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  timeWheelWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    height: 220,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  timeWheel: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: '#F8FAFC',
  },
  timeWheelContent: {
    paddingVertical: 76,
  },
  timeWheelItem: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginHorizontal: 6,
  },
  timeWheelItemActive: {
    backgroundColor: '#111827',
  },
  timeWheelText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '900',
  },
  timeWheelTextActive: {
    color: '#FFFFFF',
    fontSize: 21,
  },
});
