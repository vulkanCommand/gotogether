import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppFooter from '../components/AppFooter';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { ItineraryDay, ItineraryEvent, useTripStore } from '../store/tripStore';
import {
  ApiPlaceResult,
  completeItineraryEvent,
  createItineraryDay,
  createItineraryEvent,
  deleteItineraryDay,
  deleteItineraryEvent,
  reopenItineraryEvent,
  searchPlaces,
  updateItineraryEvent,
  apiRequest,
} from '../config/api';
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

const formatTimeLabel = (date: Date) => {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  return `${hours12}:${minutes} ${meridiem}`;
};

const MINUTE_STEPS = Array.from({ length: 12 }, (_, index) => index * 5);

const snapTimeToFiveMinutes = (date: Date) => {
  const next = new Date(date);
  const rawMinutes = next.getMinutes();
  const snappedMinutes = MINUTE_STEPS.reduce(
    (closest, option) => (Math.abs(option - rawMinutes) < Math.abs(closest - rawMinutes) ? option : closest),
    MINUTE_STEPS[0]
  );
  next.setMinutes(snappedMinutes, 0, 0);
  return next;
};

const parseTimeLabel = (value: string) => {
  const base = snapTimeToFiveMinutes(new Date());
  const match = value.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) {
    return base;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) {
    hours += 12;
  }
  if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  }

  base.setHours(hours, minutes, 0, 0);
  return snapTimeToFiveMinutes(base);
};

const buildTimeValue = (hour12: number, minute: number, meridiem: 'AM' | 'PM') => {
  const next = new Date();
  let hours24 = hour12 % 12;
  if (meridiem === 'PM') {
    hours24 += 12;
  }
  next.setHours(hours24, minute, 0, 0);
  return next;
};

const normalizeDayTitles = (days: ItineraryDay[]) =>
  days.map((day, index) => ({
    ...day,
    title: `Day ${index + 1}`,
  }));

const parseFallbackDayIndex = (dayId: string) => {
  const match = dayId.match(/^day-fallback-(\d+)$/);
  return match ? Number(match[1]) : -1;
};

export default function ItineraryScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const setItineraryDays = useTripStore((state) => state.setItineraryDays);
  const updateEventInDay = useTripStore((state) => state.updateEventInDay);

  const [selectedDayId, setSelectedDayId] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [time, setTime] = useState('');
  const [timeValue, setTimeValue] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [locationIsMapped, setLocationIsMapped] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [locationResults, setLocationResults] = useState<ApiPlaceResult[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const hasFetchedRef = useRef(false);

  const canManageItinerary = currentTrip?.viewer_role === 'lead';

  const hydrateBackendDays = useCallback(async () => {
    if (!currentTrip?.id) {
      return [] as ItineraryDay[];
    }

    const fallbackDays = buildFallbackDays(currentTrip.start_date, currentTrip.end_date);
    if (fallbackDays.length === 0) {
      return [];
    }

    for (const [index, day] of fallbackDays.entries()) {
      await createItineraryDay(currentTrip.id, {
        title: `Day ${index + 1}`,
        dateLabel: day.dateLabel,
      });
    }

    const seeded = await apiRequest<{ days: ItineraryDay[] }>(`/api/trips/${currentTrip.id}/itinerary`);
    return Array.isArray(seeded.days) ? normalizeDayTitles(seeded.days) : [];
  }, [currentTrip?.end_date, currentTrip?.id, currentTrip?.start_date]);

  const fetchItinerary = useCallback(async () => {
    if (!currentTrip?.id) {
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest<{ days: ItineraryDay[] }>(`/api/trips/${currentTrip.id}/itinerary`);
      let days =
        Array.isArray(data.days) && data.days.length > 0
          ? normalizeDayTitles(data.days)
          : [];

      if (days.length === 0 && canManageItinerary) {
        days = await hydrateBackendDays();
      }

      if (days.length === 0) {
        days = buildFallbackDays(currentTrip.start_date, currentTrip.end_date);
      }

      setItineraryDays(days);
      hasFetchedRef.current = true;
    } catch (error) {
      console.log('Fetch itinerary failed', error);
      if (!hasFetchedRef.current) {
        setItineraryDays(buildFallbackDays(currentTrip?.start_date, currentTrip?.end_date));
      }
    } finally {
      setLoading(false);
    }
  }, [canManageItinerary, currentTrip?.end_date, currentTrip?.id, currentTrip?.start_date, hydrateBackendDays, setItineraryDays]);

  useFocusEffect(
    useCallback(() => {
      fetchItinerary();
    }, [fetchItinerary])
  );

  useEffect(() => {
    if ((!selectedDayId || !itineraryDays.some((day) => day.id === selectedDayId)) && itineraryDays[0]) {
      setSelectedDayId(itineraryDays[0].id);
    }
  }, [itineraryDays, selectedDayId]);

  useEffect(() => {
    if (!showEventModal) {
      setLocationResults([]);
      setSearchingLocations(false);
      return;
    }

    const trimmedLocation = location.trim();
    if (trimmedLocation.length < 3 || locationIsMapped) {
      setLocationResults([]);
      setSearchingLocations(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchingLocations(true);
        const response = await searchPlaces(trimmedLocation);
        setLocationResults(response.results);
      } catch (error) {
        console.log('Search places failed', error);
        setLocationResults([]);
      } finally {
        setSearchingLocations(false);
      }
    }, 260);

    return () => clearTimeout(timeout);
  }, [location, locationIsMapped, showEventModal]);

  const selectedDay = useMemo(
    () => itineraryDays.find((day) => day.id === selectedDayId) ?? itineraryDays[0] ?? null,
    [itineraryDays, selectedDayId]
  );

  const ensureBackendDay = useCallback(
    async (day: ItineraryDay | null) => {
      if (!day) {
        return null;
      }

      if (!day.id.startsWith('day-fallback-')) {
        return day;
      }

      if (!canManageItinerary) {
        return null;
      }

      const nextDays = await hydrateBackendDays();
      if (nextDays.length === 0) {
        return null;
      }

      setItineraryDays(nextDays);
      const fallbackIndex = parseFallbackDayIndex(day.id);
      const resolvedDay = nextDays[fallbackIndex] ?? nextDays[0] ?? null;
      if (resolvedDay) {
        setSelectedDayId(resolvedDay.id);
      }
      return resolvedDay;
    },
    [canManageItinerary, hydrateBackendDays, setItineraryDays]
  );

  const resetEventForm = () => {
    const now = snapTimeToFiveMinutes(new Date());
    setEditingEventId(null);
    setEventTitle('');
    setTime(formatTimeLabel(now));
    setTimeValue(now);
    setLocation('');
    setLocationIsMapped(false);
    setNotes('');
    setShowTimePicker(false);
    setLocationResults([]);
  };

  const openCreateEvent = () => {
    resetEventForm();
    setShowEventModal(true);
  };

  const openEditEvent = (event: ItineraryEvent) => {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setTime(event.time);
    setTimeValue(parseTimeLabel(event.time));
    setLocation(event.location);
    setLocationIsMapped(Boolean(event.locationIsMapped));
    setNotes(event.notes);
    setShowTimePicker(false);
    setShowEventModal(true);
  };

  const chooseLocation = async (result: ApiPlaceResult) => {
    setLocation(result.display_name);
    setLocationIsMapped(true);
    setLocationResults([]);
    await Haptics.selectionAsync().catch(() => undefined);
  };

  const syncTimeValue = async (nextValue: Date) => {
    const snappedValue = snapTimeToFiveMinutes(nextValue);
    setTimeValue(snappedValue);
    setTime(formatTimeLabel(snappedValue));
    await Haptics.selectionAsync().catch(() => undefined);
  };

  const adjustHour = async (delta: 1 | -1) => {
    const hours24 = timeValue.getHours();
    const currentHour12 = hours24 % 12 || 12;
    const nextHour12 = ((currentHour12 - 1 + delta + 12) % 12) + 1;
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    await syncTimeValue(buildTimeValue(nextHour12, timeValue.getMinutes(), meridiem));
  };

  const adjustMinute = async (delta: 5 | -5) => {
    const snappedMinutes = snapTimeToFiveMinutes(timeValue).getMinutes();
    const currentIndex = Math.max(0, MINUTE_STEPS.findIndex((option) => option === snappedMinutes));
    const nextIndex = (currentIndex + (delta > 0 ? 1 : -1) + MINUTE_STEPS.length) % MINUTE_STEPS.length;
    const nextValue = new Date(timeValue);
    let nextHours = nextValue.getHours();
    if (delta > 0 && snappedMinutes === MINUTE_STEPS[MINUTE_STEPS.length - 1]) {
      nextHours = (nextHours + 1) % 24;
    }
    if (delta < 0 && snappedMinutes === MINUTE_STEPS[0]) {
      nextHours = (nextHours + 23) % 24;
    }
    nextValue.setHours(nextHours, MINUTE_STEPS[nextIndex], 0, 0);
    await syncTimeValue(nextValue);
  };

  const setMeridiem = async (meridiem: 'AM' | 'PM') => {
    const currentHour12 = timeValue.getHours() % 12 || 12;
    const nextValue = buildTimeValue(currentHour12, snapTimeToFiveMinutes(timeValue).getMinutes(), meridiem);
    await syncTimeValue(nextValue);
  };

  const saveEvent = async () => {
    if (!currentTrip?.id || !selectedDay || !eventTitle.trim() || !time.trim()) {
      Alert.alert('Missing details', 'Add at least an event title and time.');
      return;
    }

    try {
      setSaving(true);
      const targetDay = await ensureBackendDay(selectedDay);
      if (!targetDay) {
        throw new Error('Could not prepare this itinerary day yet.');
      }
      if (editingEventId) {
        await updateItineraryEvent(currentTrip.id, editingEventId, {
          title: eventTitle.trim(),
          time: time.trim(),
          location: location.trim() || 'Location TBD',
          locationIsMapped,
          notes: notes.trim(),
          attendees: [],
        });
      } else {
        await createItineraryEvent(currentTrip.id, targetDay.id, {
          title: eventTitle.trim(),
          time: time.trim(),
          location: location.trim() || 'Location TBD',
          locationIsMapped,
          notes: notes.trim(),
          attendees: [],
        });
      }

      setShowEventModal(false);
      resetEventForm();
      await fetchItinerary();
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save the event right now.');
    } finally {
      setSaving(false);
    }
  };

  const addDay = async () => {
    if (!currentTrip?.id) {
      return;
    }

    const dayNumber = itineraryDays.length + 1;
    const nextDate = parseTripDate(currentTrip.start_date);
    if (nextDate) {
      nextDate.setDate(nextDate.getDate() + itineraryDays.length);
    }

    try {
      setSaving(true);
      const response = await createItineraryDay(currentTrip.id, {
        title: `Day ${dayNumber}`,
        dateLabel: nextDate ? formatTripDate(nextDate.toISOString().slice(0, 10)) : `Extra day ${dayNumber}`,
      });
      await fetchItinerary();
      setSelectedDayId(response.day.id);
    } catch (error: any) {
      Alert.alert('Add day failed', error?.message || 'Could not add a new day right now.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDay = (day: ItineraryDay) => {
    if (!currentTrip?.id) {
      return;
    }

    Alert.alert('Delete day', `Remove ${day.title} and all of its events?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            const targetDay = await ensureBackendDay(day);
            if (!targetDay) {
              throw new Error('Could not prepare this itinerary day yet.');
            }
            await deleteItineraryDay(currentTrip.id, targetDay.id);
            await fetchItinerary();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete the day right now.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const openDayActions = (day: ItineraryDay) => {
    if (!canManageItinerary) {
      return;
    }

    Alert.alert(day.title, 'Choose an action for this day.', [
      { text: 'Delete day', style: 'destructive', onPress: () => confirmDeleteDay(day) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const deleteEventAction = (event: ItineraryEvent) => {
    if (!currentTrip?.id) {
      return;
    }

    Alert.alert('Delete event', `Remove ${event.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await deleteItineraryEvent(currentTrip.id, event.id);
            await fetchItinerary();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete the event right now.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const openEventActions = (event: ItineraryEvent) => {
    if (!canManageItinerary) {
      return;
    }

    if (event.status === 'completed') {
      Alert.alert('Event completed', 'Completed events are locked and can no longer be edited or deleted.');
      return;
    }

    const actionButtons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: 'Edit', onPress: () => openEditEvent(event) },
    ];

    actionButtons.push(
      { text: 'Delete', style: 'destructive', onPress: () => deleteEventAction(event) },
      { text: 'Cancel', style: 'cancel' }
    );

    Alert.alert(event.title, 'Choose an action for this event.', actionButtons);
  };

  const applyEventCompletion = async (event: ItineraryEvent) => {
    if (!currentTrip?.id) {
      return;
    }

    const owningDay = itineraryDays.find((day) => day.events.some((item) => item.id === event.id));
    if (!owningDay) {
      return;
    }

    const previousStatus = event.status;
    const nextStatus = event.status === 'completed' ? 'active' : 'completed';

    try {
      setSaving(true);
      updateEventInDay(owningDay.id, event.id, { status: nextStatus });
      const response =
        event.status === 'completed'
          ? await reopenItineraryEvent(currentTrip.id, event.id)
          : await completeItineraryEvent(currentTrip.id, event.id);
      setItineraryDays(response.days);
    } catch (error: any) {
      updateEventInDay(owningDay.id, event.id, { status: previousStatus });
      Alert.alert('Update failed', error?.message || 'Could not update the event right now.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEventCompletion = (event: ItineraryEvent) => {
    if (event.status === 'completed') {
      return;
    }

    Alert.alert('Complete event', `Mark ${event.title} as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => void applyEventCompletion(event) },
    ]);
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
            <Pressable onPress={openCreateEvent} style={styles.addButton}>
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
                onLongPress={() => openDayActions(day)}
                style={[styles.dayTab, selected && styles.dayTabSelected]}
              >
                <Text style={[styles.dayTabTitle, selected && styles.dayTabTitleSelected]}>{day.title}</Text>
                <Text style={[styles.dayTabMeta, selected && styles.dayTabTitleSelected]}>{day.dateLabel}</Text>
                {selected && canManageItinerary ? (
                  <View style={styles.dayTabHint}>
                    <Ionicons name="ellipsis-horizontal" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {canManageItinerary ? (
            <Pressable onPress={addDay} style={styles.addDayTab} disabled={saving}>
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={styles.addDayText}>Add day</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

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
                    <View style={styles.eventHeaderRow}>
                      <View style={styles.eventHeaderCopy}>
                        <Text style={[styles.eventTime, done && styles.eventTimeDone]}>{event.time}</Text>
                        <View style={styles.eventTitleRow}>
                          <Text style={[styles.eventTitle, done && styles.eventTitleDone]}>{event.title}</Text>
                          {done ? (
                            <View style={styles.completedTag}>
                              <Text style={styles.completedTagText}>Completed</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {canManageItinerary && !done ? (
                        <Pressable style={styles.eventMenuButton} onPress={() => openEventActions(event)}>
                          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={[styles.eventLocation, done && styles.eventMetaDone]}>
                      <Ionicons name="location-outline" size={12} color={colors.textMuted} /> {event.location}
                    </Text>
                    {event.notes ? <Text style={[styles.eventNotes, done && styles.eventMetaDone]}>{event.notes}</Text> : null}

                    {canManageItinerary && !done ? (
                      <View style={styles.eventActions}>
                        <Pressable style={styles.eventActionChip} onPress={() => toggleEventCompletion(event)}>
                          <Text style={styles.eventActionText}>Complete</Text>
                        </Pressable>
                      </View>
                    ) : null}
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

      <Modal transparent visible={showEventModal} animationType="slide" onRequestClose={() => setShowEventModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEventModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoider}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>{editingEventId ? 'Edit Event' : 'Add Event'}</Text>

                <TextInput
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="Event title"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />

                <Pressable
                  style={[styles.input, styles.timeButton]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={time ? styles.timeButtonText : styles.timeButtonPlaceholder}>{time || 'Select time'}</Text>
                  <Ionicons name="time-outline" size={18} color={colors.accent} />
                </Pressable>

                {showTimePicker ? (
                  <View style={styles.pickerWrap}>
                    <Text style={styles.inlineTimeLabel}>Set time</Text>
                    <View style={styles.timeEditorRow}>
                      <View style={styles.timeEditorColumn}>
                        <Pressable style={styles.timeAdjustButton} onPress={() => void adjustHour(1)}>
                          <Ionicons name="chevron-up" size={18} color={colors.accent} />
                        </Pressable>
                        <Text style={styles.timeEditorValue}>{`${timeValue.getHours() % 12 || 12}`.padStart(2, '0')}</Text>
                        <Pressable style={styles.timeAdjustButton} onPress={() => void adjustHour(-1)}>
                          <Ionicons name="chevron-down" size={18} color={colors.accent} />
                        </Pressable>
                      </View>
                      <Text style={styles.timeEditorSeparator}>:</Text>
                      <View style={styles.timeEditorColumn}>
                        <Pressable style={styles.timeAdjustButton} onPress={() => void adjustMinute(5)}>
                          <Ionicons name="chevron-up" size={18} color={colors.accent} />
                        </Pressable>
                        <Text style={styles.timeEditorValue}>
                          {`${snapTimeToFiveMinutes(timeValue).getMinutes()}`.padStart(2, '0')}
                        </Text>
                        <Pressable style={styles.timeAdjustButton} onPress={() => void adjustMinute(-5)}>
                          <Ionicons name="chevron-down" size={18} color={colors.accent} />
                        </Pressable>
                      </View>
                      <View style={styles.meridiemColumn}>
                        <Pressable
                          style={[styles.meridiemButton, timeValue.getHours() < 12 && styles.meridiemButtonSelected]}
                          onPress={() => void setMeridiem('AM')}
                        >
                          <Text
                            style={[
                              styles.meridiemButtonText,
                              timeValue.getHours() < 12 && styles.meridiemButtonTextSelected,
                            ]}
                          >
                            AM
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.meridiemButton, timeValue.getHours() >= 12 && styles.meridiemButtonSelected]}
                          onPress={() => void setMeridiem('PM')}
                        >
                          <Text
                            style={[
                              styles.meridiemButtonText,
                              timeValue.getHours() >= 12 && styles.meridiemButtonTextSelected,
                            ]}
                          >
                            PM
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    <Pressable style={styles.timeDoneButton} onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.timeDoneButtonText}>Done</Text>
                    </Pressable>
                  </View>
                ) : null}

                <TextInput
                  value={location}
                  onChangeText={(value) => {
                    setLocation(value);
                    setLocationIsMapped(false);
                  }}
                  placeholder="Search location"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputTopSpacing]}
                />

                {searchingLocations ? (
                  <View style={styles.locationStatusRow}>
                    <ActivityIndicator color={colors.accent} size="small" />
                    <Text style={styles.locationStatusText}>Searching places...</Text>
                  </View>
                ) : null}

                {locationResults.length > 0 ? (
                  <View style={styles.locationResults}>
                    {locationResults.map((result) => (
                      <Pressable key={result.id} style={styles.locationOption} onPress={() => chooseLocation(result)}>
                        <Text style={styles.locationOptionTitle}>{result.title}</Text>
                        <Text style={styles.locationOptionSubtitle}>{result.subtitle}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : location.trim().length >= 3 && !locationIsMapped && !searchingLocations ? (
                  <Text style={styles.locationEmptyText}>No places found yet. Try a broader search.</Text>
                ) : null}

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={[styles.input, styles.notesInput]}
                />

                <Pressable onPress={saveEvent} style={styles.saveButton} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? 'Saving...' : editingEventId ? 'Save Event' : 'Add Event'}</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

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
    paddingBottom: 36,
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
    minWidth: 98,
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
  dayTabHint: {
    position: 'absolute',
    right: 6,
    top: 6,
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
  loadingBox: {
    marginBottom: spacing.md,
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
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    opacity: 0.88,
  },
  eventTime: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  eventTimeDone: {
    color: colors.textMuted,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventHeaderCopy: {
    flex: 1,
  },
  eventTitleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventMenuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  eventTitleDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  completedTag: {
    borderRadius: radius.pill,
    backgroundColor: '#E8F7EC',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedTagText: {
    color: '#207245',
    fontSize: 11,
    fontWeight: '800',
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
  eventMetaDone: {
    color: colors.textMuted,
  },
  eventActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  eventActionChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eventActionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  eventDeleteChip: {
    borderColor: '#F3C9C4',
    backgroundColor: '#FFF6F5',
  },
  eventDeleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
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
  inputTopSpacing: {
    marginTop: spacing.sm,
  },
  timeButton: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  timeButtonPlaceholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  pickerWrap: {
    marginTop: spacing.sm,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
  },
  inlineTimeLabel: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  timeEditorRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 18,
  },
  timeEditorColumn: {
    alignItems: 'center',
    gap: 10,
    minWidth: 56,
  },
  meridiemColumn: {
    alignItems: 'center',
    gap: 10,
    minWidth: 82,
  },
  timeAdjustButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeEditorValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  timeEditorSeparator: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
  },
  meridiemButton: {
    minWidth: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meridiemButtonSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },
  meridiemButtonText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '800',
  },
  meridiemButtonTextSelected: {
    color: colors.accent,
  },
  timeDoneButton: {
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  timeDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  locationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  locationStatusText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  locationResults: {
    marginTop: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  locationOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationOptionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  locationOptionSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  locationEmptyText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
