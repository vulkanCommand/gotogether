import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { RootStackParamList } from '../navigation/AppNavigator';
import { saveTripSetupStatus } from '../config/api';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'TripSetup'>;

const days = Array.from({ length: 30 }, (_, index) => String(index + 1));

export default function TripSetupScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const crew = useTripStore((state) => state.crew);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [leadVoteUserId, setLeadVoteUserId] = useState<number>(Number(crew[0]?.id || 0));
  const [saving, setSaving] = useState(false);

  const tripName = currentTrip?.name ?? 'Trip setup';
  const sortedDates = useMemo(() => selectedDates.slice().sort((a, b) => Number(a) - Number(b)), [selectedDates]);

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
      navigation.replace('TripOverview');
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen showFooter>
      <SectionTitle
        title="Join Trip"
        subtitle={`Before viewing ${tripName}, choose your availability and vote for the trip lead.`}
        action={<NotificationBell />}
      />

      <AppCard>
        <Text style={styles.cardTitle}>Your available dates</Text>
        <Text style={styles.cardMeta}>Tap every day you can make the trip.</Text>
        <View style={styles.calendarGrid}>
          {days.map((day) => {
            const selected = selectedDates.includes(day);
            return (
              <Pressable
                key={day}
                style={[styles.dayChip, selected && styles.dayChipSelected]}
                onPress={() => toggleDate(day)}
              >
                <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Vote for trip lead</Text>
        <Text style={styles.cardMeta}>The lead manages itinerary and completion controls.</Text>
        <View style={styles.memberList}>
          {crew.map((member) => {
            const selected = leadVoteUserId === Number(member.id);
            return (
              <Pressable
                key={member.id}
                style={[styles.memberRow, selected && styles.memberRowSelected]}
                onPress={() => setLeadVoteUserId(Number(member.id))}
              >
                <Text style={[styles.memberName, selected && styles.memberNameSelected]}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.role || 'member'}</Text>
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
    width: 42,
    height: 42,
    borderRadius: 21,
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
  dayTextSelected: {
    color: '#FFFFFF',
  },
  memberList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  memberRow: {
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
  memberNameSelected: {
    color: colors.accent,
  },
  memberRole: {
    marginTop: 4,
    color: colors.textSecondary,
  },
});
