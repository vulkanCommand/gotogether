import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import {
  ApiTrip,
  deleteTrip,
  ensureTripCoverFromDestination,
  fetchTripDetails,
  fetchTrips,
  tripCoverFileUrl,
  updateTrip,
} from '../config/api';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { prototypeImages } from '../utils/prototypeAssets';
import { formatTripRange, isTripCurrentSection, isTripUpcoming, mapApiMembersToCrew, tripTimelineStatus } from '../utils/tripFlow';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Trips'>,
  NativeStackScreenProps<RootStackParamList>
>;

type TripSection = 'Current' | 'Upcoming' | 'Completed';

const sections: TripSection[] = ['Current', 'Upcoming', 'Completed'];

const parseDateValue = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? normalizeDateValue(new Date()) : normalizeDateValue(parsed);
};

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateValue = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getTripsForSection = (allTrips: ApiTrip[], section: TripSection) => {
  const nextTrips = [...allTrips];

  switch (section) {
    case 'Completed':
      return nextTrips
        .filter((trip) => Boolean(trip.completed_at))
        .sort((a, b) => new Date(`${b.end_date}T00:00:00`).getTime() - new Date(`${a.end_date}T00:00:00`).getTime());
    case 'Upcoming':
      return nextTrips
        .filter((trip) => isTripUpcoming(trip))
        .sort((a, b) => new Date(`${a.start_date}T00:00:00`).getTime() - new Date(`${b.start_date}T00:00:00`).getTime());
    default:
      return nextTrips
        .filter((trip) => isTripCurrentSection(trip))
        .sort((a, b) => new Date(`${a.start_date}T00:00:00`).getTime() - new Date(`${b.start_date}T00:00:00`).getTime());
  }
};

export default function TripsScreen({ navigation, route }: Props) {
  const token = useAuthStore((state) => state.token);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);
  const resetTrip = useTripStore((state) => state.resetTrip);
  const insets = useSafeAreaInsets();

  const pagerRef = useRef<FlatList<TripSection>>(null);
  const hasLoadedRef = useRef(false);
  const screenWidth = Dimensions.get('window').width;

  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManageModal, setShowManageModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTrip, setEditingTrip] = useState<ApiTrip | null>(null);
  const [tripName, setTripName] = useState('');
  const [tripDestination, setTripDestination] = useState('');
  const [tripStartDate, setTripStartDate] = useState(new Date());
  const [tripEndDate, setTripEndDate] = useState(new Date());
  const [activeDateField, setActiveDateField] = useState<'start' | 'end' | null>(null);
  const [activeSection, setActiveSection] = useState<TripSection>('Current');

  useEffect(() => {
    const requestedSection = route.params?.initialSection;

    if (requestedSection) {
      setActiveSection(requestedSection);
      const requestedIndex = sections.indexOf(requestedSection);

      requestAnimationFrame(() => {
        pagerRef.current?.scrollToIndex({ index: requestedIndex, animated: false });
      });
    }
  }, [route.params?.initialSection]);

  const sectionTrips = useMemo(() => {
    return {
      Current: getTripsForSection(trips, 'Current'),
      Upcoming: getTripsForSection(trips, 'Upcoming'),
      Completed: getTripsForSection(trips, 'Completed'),
    };
  }, [trips]);

  const loadTrips = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      const response = await fetchTrips();
      setTrips(Array.isArray(response.trips) ? response.trips : []);
      hasLoadedRef.current = true;
    } catch (error) {
      console.log('Trips fetch failed', error);

      if (!hasLoadedRef.current) {
        setTrips([]);
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips(!hasLoadedRef.current);
    }, [loadTrips])
  );

  const jumpToSection = async (section: TripSection) => {
    const index = sections.indexOf(section);
    setActiveSection(section);
    pagerRef.current?.scrollToIndex({ index, animated: true });
    await Haptics.selectionAsync().catch(() => undefined);
  };

  const handlePagerMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    const nextSection = sections[index];

    if (nextSection && nextSection !== activeSection) {
      setActiveSection(nextSection);
    }
  };

  const openTrip = async (trip: ApiTrip) => {
    try {
      const details = await fetchTripDetails(trip.id);
      const crew = mapApiMembersToCrew(details.members);

      setCurrentTrip(details.trip);
      setCrew(crew);
      setTripLead(crew.find((member) => member.role === 'lead') ?? crew[0] ?? null);

      navigation.navigate(details.trip.completed_at ? 'TripCompletion' : 'TripOverview');
    } catch (error) {
      console.log('Open trip failed', error);
    }
  };

  const openManageTrip = async (trip: ApiTrip) => {
    setEditingTrip(trip);
    setTripName(trip.name);
    setTripDestination(trip.destination);
    setTripStartDate(parseDateValue(trip.start_date));
    setTripEndDate(parseDateValue(trip.end_date));
    setActiveDateField(null);
    setShowManageModal(true);

    await Haptics.selectionAsync().catch(() => undefined);
  };

  const closeManageModal = () => {
    if (saving) {
      return;
    }

    setShowManageModal(false);
    setEditingTrip(null);
    setActiveDateField(null);
  };

  const onDateChange =
    (field: 'start' | 'end') =>
    async (event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === 'android') {
        setActiveDateField(null);
      }

      if (event.type === 'dismissed' || !selected) {
        return;
      }

      const normalizedSelected = normalizeDateValue(selected);
      const normalizedStart = normalizeDateValue(tripStartDate);
      const normalizedEnd = normalizeDateValue(tripEndDate);

      if (field === 'start') {
        setTripStartDate(normalizedSelected);

        if (normalizedSelected.getTime() > normalizedEnd.getTime()) {
          setTripEndDate(normalizedSelected);
        }
      } else {
        setTripEndDate(normalizedSelected.getTime() < normalizedStart.getTime() ? normalizedStart : normalizedSelected);
      }

      await Haptics.selectionAsync().catch(() => undefined);
    };

  const openDatePicker = (field: 'start' | 'end') => {
    setActiveDateField(field);
  };

  const activeDateValue =
    activeDateField === 'start'
      ? tripStartDate
      : tripEndDate.getTime() < tripStartDate.getTime()
        ? tripStartDate
        : tripEndDate;

  const saveTripEdits = async () => {
    if (!editingTrip) {
      return;
    }

    if (!tripName.trim() || !tripDestination.trim()) {
      Alert.alert('Missing details', 'Add a trip name and destination before saving.');
      return;
    }

    try {
      setSaving(true);

      const nextDestination = tripDestination.trim();
      const nextEndDate = tripEndDate.getTime() < tripStartDate.getTime() ? tripStartDate : tripEndDate;
      const destinationChanged = nextDestination.toLowerCase() !== (editingTrip.destination || '').trim().toLowerCase();

      await updateTrip(editingTrip.id, {
        name: tripName.trim(),
        destination: nextDestination,
        start_date: formatDateValue(tripStartDate),
        end_date: formatDateValue(nextEndDate),
      });

      setTrips((current) =>
        current.map((trip) =>
          trip.id === editingTrip.id
            ? {
                ...trip,
                name: tripName.trim(),
                destination: nextDestination,
                start_date: formatDateValue(tripStartDate),
                end_date: formatDateValue(nextEndDate),
              }
            : trip
        )
      );

      if (destinationChanged) {
        ensureTripCoverFromDestination(editingTrip.id)
          .then((cover) => {
            if (!cover.image_url) {
              return;
            }

            setTrips((current) =>
              current.map((trip) =>
                trip.id === editingTrip.id
                  ? {
                      ...trip,
                      image_url: cover.image_url,
                    }
                  : trip
              )
            );
          })
          .catch((error) => {
            console.log('Trip cover refresh failed after destination update', error);
          });
      }

      closeManageModal();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message || 'Could not update the trip right now.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTrip = () => {
    if (!editingTrip) {
      return;
    }

    Alert.alert('Delete trip', `Delete ${editingTrip.name}? This removes the trip for the whole crew.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);

            await deleteTrip(editingTrip.id);

            setTrips((current) => current.filter((trip) => trip.id !== editingTrip.id));
            resetTrip();
            closeManageModal();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete the trip right now.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const renderTripCard = ({ item: trip, index }: { item: ApiTrip; index: number }) => (
    <Pressable onPress={() => openTrip(trip)} style={styles.tripCard}>
      <View style={styles.imageWrap}>
        <Image
          source={
            trip.image_url && token
              ? ({ uri: tripCoverFileUrl(trip.id), headers: { Authorization: `Bearer ${token}` }, cache: 'force-cache' } as any)
              : index % 3 === 0
                ? prototypeImages.tripHero
                : index % 3 === 1
                  ? prototypeImages.alps
                  : prototypeImages.santorini
          }
          style={styles.tripImage}
        />

        <View style={styles.statusWrap}>
          <Text style={[styles.statusText, tripTimelineStatus(trip) === 'Active' && styles.statusTextActive]}>
            {tripTimelineStatus(trip)}
          </Text>
        </View>

        {!trip.completed_at ? (
          <Pressable
            style={styles.manageHint}
            onPress={(event) => {
              event.stopPropagation();
              openManageTrip(trip);
            }}
            hitSlop={12}
          >
            <Ionicons name="ellipsis-horizontal" size={17} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tripContent}>
        <Text style={styles.tripTitle}>{trip.name}</Text>
        <Text style={styles.tripDestination}>{trip.destination}</Text>
        <Text style={styles.tripMeta}>
          {formatTripRange(trip.start_date, trip.end_date)} - {trip.members_count ?? 1} members
        </Text>
      </View>
    </Pressable>
  );

  const renderSectionPage = ({ item: section }: { item: TripSection }) => {
    const pageTrips = sectionTrips[section];

    if (loading && trips.length === 0) {
      return (
        <View style={[styles.page, { width: screenWidth }]}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} />
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.page, { width: screenWidth }]}>
        <FlatList
          data={pageTrips}
          keyExtractor={(trip) => String(trip.id)}
          renderItem={renderTripCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: 108 + Math.max(insets.bottom, 12) }]}
          ItemSeparatorComponent={() => <View style={styles.listGap} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No {section.toLowerCase()} trips</Text>
              <Text style={styles.emptyCopy}>
                {section === 'Completed'
                  ? 'Finished trips will live here once you wrap them up.'
                  : section === 'Upcoming'
                    ? 'Your next planned getaways will show up here.'
                    : 'Trips happening now, or waiting to be wrapped up, will show here.'}
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top, 16) + 28 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>My Trips</Text>
          <Text style={styles.subtitle}>{trips.length} trips planned</Text>
        </View>

        <View style={styles.sectionToggle}>
          {sections.map((section) => {
            const selected = section === activeSection;

            return (
              <Pressable
                key={section}
                onPress={() => jumpToSection(section)}
                style={[styles.sectionToggleButton, selected && styles.sectionToggleButtonActive]}
              >
                <Text style={[styles.sectionToggleText, selected && styles.sectionToggleTextActive]}>{section}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        ref={pagerRef}
        data={sections}
        keyExtractor={(section) => section}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        renderItem={renderSectionPage}
        onMomentumScrollEnd={handlePagerMomentumEnd}
        getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
      />

      <Modal transparent visible={showManageModal} animationType="slide" onRequestClose={closeManageModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeManageModal}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoider}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHandle} />

                <Text style={styles.modalTitle}>Manage Trip</Text>
                <Text style={styles.modalSubtitle}>Update the trip name, destination, or dates.</Text>

                <TextInput
                  value={tripName}
                  onChangeText={setTripName}
                  placeholder="Trip name"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />

                <TextInput
                  value={tripDestination}
                  onChangeText={setTripDestination}
                  placeholder="Destination"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputTopSpacing]}
                />

                <Pressable
                  style={[styles.input, styles.dateButton, styles.inputTopSpacing]}
                  onPress={() => openDatePicker('start')}
                >
                  <Text style={styles.dateButtonLabel}>Start date</Text>
                  <Text style={styles.dateButtonValue}>{formatDateValue(tripStartDate)}</Text>
                </Pressable>

                <Pressable
                  style={[styles.input, styles.dateButton, styles.inputTopSpacing]}
                  onPress={() => openDatePicker('end')}
                >
                  <Text style={styles.dateButtonLabel}>End date</Text>
                  <Text style={styles.dateButtonValue}>
                    {formatDateValue(tripEndDate.getTime() < tripStartDate.getTime() ? tripStartDate : tripEndDate)}
                  </Text>
                </Pressable>

                {Platform.OS === 'ios' && activeDateField ? (
                  <View style={styles.pickerWrap}>
                    <Text style={styles.inlinePickerTitle}>
                      {activeDateField === 'start' ? 'Pick start date' : 'Pick end date'}
                    </Text>

                    <DateTimePicker
                      mode="date"
                      value={activeDateValue}
                      minimumDate={activeDateField === 'end' ? tripStartDate : undefined}
                      display="inline"
                      onChange={onDateChange(activeDateField)}
                    />

                    <Pressable style={styles.inlinePickerDoneButton} onPress={() => setActiveDateField(null)}>
                      <Text style={styles.inlinePickerDoneText}>Done</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Pressable onPress={saveTripEdits} style={styles.saveButton} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
                </Pressable>

                <Pressable onPress={confirmDeleteTrip} style={styles.deleteButton} disabled={saving}>
                  <Text style={styles.deleteButtonText}>Delete trip</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {Platform.OS === 'android' && activeDateField ? (
        <DateTimePicker
          mode="date"
          value={activeDateValue}
          minimumDate={activeDateField === 'end' ? tripStartDate : undefined}
          display="calendar"
          onChange={onDateChange(activeDateField)}
        />
      ) : null}
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
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 15,
  },
  sectionToggle: {
    marginBottom: spacing.lg,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 5,
    gap: 5,
  },
  sectionToggleButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionToggleButtonActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  sectionToggleText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionToggleTextActive: {
    color: '#FFFFFF',
  },
  page: {
    paddingHorizontal: 20,
  },
  listContent: {
    flexGrow: 1,
  },
  listGap: {
    height: spacing.lg,
  },
  loadingCard: {
    minHeight: 180,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowStrong,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  imageWrap: {
    position: 'relative',
  },
  tripImage: {
    width: '100%',
    height: 164,
  },
  statusWrap: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  statusTextActive: {
    color: colors.success,
  },
  manageHint: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripContent: {
    padding: 18,
  },
  tripTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  tripDestination: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  tripMeta: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '900',
  },
  emptyCopy: {
    marginTop: 8,
    color: colors.textSecondary,
    lineHeight: 21,
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
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    marginTop: 6,
    marginBottom: spacing.md,
    color: colors.textSecondary,
    lineHeight: 20,
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  dateButtonValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
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
  inlinePickerTitle: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  inlinePickerDoneButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inlinePickerDoneText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
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
  deleteButton: {
    marginTop: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3C9C4',
    backgroundColor: '#FFF6F5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginBottom: spacing.sm,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
  },
});
