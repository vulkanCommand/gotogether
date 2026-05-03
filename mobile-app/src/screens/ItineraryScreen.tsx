import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { ItineraryDay, useTripStore } from '../store/tripStore';
import { apiRequest } from '../config/api';
import { formatTripDate, formatTripRange } from '../utils/tripFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'Itinerary'>;

const parseTripDate = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildFallbackDays = (start?: string, end?: string) => {
  const startDate = parseTripDate(start);
  const endDate = parseTripDate(end);
  if (!startDate || !endDate || endDate < startDate) {
    return [];
  }

  const days: ItineraryDay[] = [];
  const cursor = new Date(startDate);
  let index = 0;

  while (cursor <= endDate && index < 14) {
    days.push({
      id: `day-fallback-${index}`,
      title: `Day ${index + 1}`,
      dateLabel: formatTripDate(cursor.toISOString().slice(0, 10)),
      events: [],
    });
    cursor.setDate(cursor.getDate() + 1);
    index += 1;
  }

  return days;
};

export default function ItineraryScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const setItineraryDays = useTripStore((state) => state.setItineraryDays);

  const [selectedDayId, setSelectedDayId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const hasFetchedRef = useRef(false);

  const canManageItinerary = currentTrip?.viewer_role === 'lead';

  const fetchItinerary = useCallback(async () => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      const data = await apiRequest<{ days: ItineraryDay[] }>(`/api/trips/${currentTrip.id}/itinerary`);
      const days = Array.isArray(data.days) && data.days.length > 0
        ? data.days
        : buildFallbackDays(currentTrip.start_date, currentTrip.end_date);
      setItineraryDays(days);
      hasFetchedRef.current = true;
    } catch (error) {
      console.log('Fetch itinerary failed', error);
      if (!hasFetchedRef.current) {
        setItineraryDays(buildFallbackDays(currentTrip?.start_date, currentTrip?.end_date));
      }
    }
  }, [currentTrip?.end_date, currentTrip?.id, currentTrip?.start_date, setItineraryDays]);

  useFocusEffect(
    useCallback(() => {
      fetchItinerary();
    }, [fetchItinerary])
  );

  useEffect(() => {
    if (!selectedDayId && itineraryDays[0]) {
      setSelectedDayId(itineraryDays[0].id);
    }
  }, [itineraryDays, selectedDayId]);

  const selectedDay = useMemo(
    () => itineraryDays.find((day) => day.id === selectedDayId) ?? itineraryDays[0] ?? null,
    [itineraryDays, selectedDayId]
  );

  const saveItinerary = async (nextDays: ItineraryDay[]) => {
    if (!currentTrip?.id) {
      return false;
    }

    setItineraryDays(nextDays);

    if (!canManageItinerary) {
      return true;
    }

    setSaving(true);
    try {
      await apiRequest<{ message: string }>(`/api/trips/${currentTrip.id}/itinerary`, {
        method: 'PUT',
        body: JSON.stringify({
          days: nextDays.map((day) => ({
            id: day.id,
            title: day.title,
            dateLabel: day.dateLabel,
            status: day.status || 'upcoming',
            events: day.events.map((event) => ({
              id: event.id,
              dayId: day.id,
              title: event.title,
              time: event.time,
              location: event.location,
              locationIsMapped: Boolean(event.locationIsMapped),
              notes: event.notes,
              attendees: event.attendees,
              status: event.status,
            })),
          })),
        }),
      });
      return true;
    } catch (error) {
      console.log('Save itinerary failed', error);
      Alert.alert('Save failed', 'Could not save the itinerary right now.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addEvent = async () => {
    if (!selectedDay || !title.trim() || !time.trim()) {
      Alert.alert('Missing details', 'Add at least an event title and time.');
      return;
    }

    const nextDays = itineraryDays.map((day) =>
      day.id === selectedDay.id
        ? {
            ...day,
            events: [
              ...day.events,
              {
                id: `event-${Date.now()}`,
                title: title.trim(),
                time: time.trim(),
                location: location.trim() || 'Location TBD',
                notes: notes.trim(),
                attendees: [],
                status: 'upcoming' as const,
              },
            ],
          }
        : day
    );

    const saved = await saveItinerary(nextDays);
    if (!saved) {
      return;
    }

    setShowModal(false);
    setTitle('');
    setTime('');
    setLocation('');
    setNotes('');
  };

  const addItineraryDay = async () => {
    const dayNumber = itineraryDays.length + 1;
    const nextDate = parseTripDate(currentTrip?.start_date);
    if (nextDate) {
      nextDate.setDate(nextDate.getDate() + itineraryDays.length);
    }

    const nextDay: ItineraryDay = {
      id: `day-local-${Date.now()}`,
      title: `Day ${dayNumber}`,
      dateLabel: nextDate ? formatTripDate(nextDate.toISOString().slice(0, 10)) : `Extra day ${dayNumber}`,
      status: 'upcoming',
      events: [],
    };

    const nextDays = [...itineraryDays, nextDay];
    await saveItinerary(nextDays);
    setSelectedDayId(nextDay.id);
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
            </Pressable>
            <View>
              <Text style={styles.title}>Itinerary</Text>
              <Text style={styles.subtitle}>
                {currentTrip ? formatTripRange(currentTrip.start_date, currentTrip.end_date) : 'Trip dates pending'}
              </Text>
            </View>
          </View>

          {canManageItinerary ? (
            <Pressable onPress={() => setShowModal(true)} style={styles.addButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
          {itineraryDays.map((day) => {
            const selected = day.id === selectedDay?.id;
            return (
              <Pressable
                key={day.id}
                onPress={() => setSelectedDayId(day.id)}
                style={[styles.dayTab, selected && styles.dayTabSelected]}
              >
                <Text style={[styles.dayTabTitle, selected && styles.dayTabTitleSelected]}>{day.title}</Text>
                <Text style={[styles.dayTabMeta, selected && styles.dayTabTitleSelected]}>{day.dateLabel}</Text>
              </Pressable>
            );
          })}
          {canManageItinerary ? (
            <Pressable onPress={addItineraryDay} style={styles.addDayTab} disabled={saving}>
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={styles.addDayText}>Add day</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.timeline}>
          {selectedDay?.events.length ? (
            selectedDay.events.map((event, index) => {
              const done = event.status === 'completed';
              return (
                <View key={event.id} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, done && styles.timelineDotDone]}>
                      <Ionicons
                        name={done ? 'checkmark' : 'time-outline'}
                        size={13}
                        color={done ? '#FFFFFF' : colors.textMuted}
                      />
                    </View>
                    {index < selectedDay.events.length - 1 ? (
                      <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
                    ) : null}
                  </View>

                  <View style={[styles.eventCard, done && styles.eventCardDone]}>
                    <Text style={styles.eventTime}>{event.time}</Text>
                    <Text style={[styles.eventTitle, done && styles.eventTitleDone]}>{event.title}</Text>
                    <Text style={styles.eventLocation}>
                      <Ionicons name="location-outline" size={12} color={colors.textMuted} /> {event.location}
                    </Text>
                    {event.notes ? <Text style={styles.eventNotes}>{event.notes}</Text> : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No events for this day yet</Text>
              <Text style={styles.emptyCopy}>Add the first stop to start shaping the trip.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoider}
          >
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Add Event</Text>

                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Event title"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                  style={styles.input}
                />

                <View style={styles.inputRow}>
                  <TextInput
                    value={time}
                    onChangeText={setTime}
                    placeholder="Time"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="next"
                    style={[styles.input, styles.halfInput]}
                  />
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Location"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="next"
                    style={[styles.input, styles.halfInput]}
                  />
                </View>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  blurOnSubmit
                  onSubmitEditing={Keyboard.dismiss}
                  style={[styles.input, styles.notesInput]}
                />

                <Pressable onPress={addEvent} style={styles.saveButton} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Add Event'}</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
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
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTabs: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  dayTab: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dayTabSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayTabTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  dayTabMeta: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
  },
  dayTabTitleSelected: {
    color: '#FFFFFF',
  },
  addDayTab: {
    minWidth: 96,
    borderRadius: 16,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#C7DAFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addDayText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  timeline: {
    marginTop: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineRail: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 38,
    backgroundColor: colors.border,
  },
  timelineLineDone: {
    backgroundColor: 'rgba(37,99,235,0.32)',
  },
  eventCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: spacing.md,
  },
  eventCardDone: {
    opacity: 0.62,
  },
  eventTime: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  eventTitle: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  eventTitleDone: {
    textDecorationLine: 'line-through',
  },
  eventLocation: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
  },
  eventNotes: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyState: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCopy: {
    marginTop: 8,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.24)',
    justifyContent: 'flex-end',
  },
  keyboardAvoider: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  input: {
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  notesInput: {
    marginTop: spacing.sm,
    minHeight: 92,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
