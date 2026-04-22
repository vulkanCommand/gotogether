import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { CurrentTrip, ExpenseGroup, useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { createExpenseGroup, fetchExpenseGroups, fetchTripDetails, fetchTrips } from '../config/api';
import PrimaryButton from '../components/PrimaryButton';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Expenses'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ExpensesScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const expenses = useTripStore((state) => state.expenses);
  const expenseGroups = useTripStore((state) => state.expenseGroups);
  const setExpenses = useTripStore((state) => state.setExpenses);
  const setExpenseGroups = useTripStore((state) => state.setExpenseGroups);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const totalExpenseAmount = useTripStore((state) => state.totalExpenseAmount);
  const [tripSections, setTripSections] = useState<Array<{ trip: CurrentTrip; groups: ExpenseGroup[] }>>([]);
  const [loading, setLoading] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const refreshGroups = useCallback(async () => {
    try {
      setLoading(true);
      const tripData = await fetchTrips();
      const trips = Array.isArray(tripData.trips) ? tripData.trips : [];
      const sections = await Promise.all(
        trips.map(async (trip) => {
          const groupData = await fetchExpenseGroups(trip.id);
          return { trip: trip as CurrentTrip, groups: (groupData.groups ?? []) as ExpenseGroup[] };
        })
      );
      setTripSections(sections);
      const activeTripId = currentTrip?.id ?? sections[0]?.trip.id;
      const activeGroups = sections.find((section) => section.trip.id === activeTripId)?.groups ?? [];
      setExpenseGroups(activeGroups);
      setExpenses(activeGroups.flatMap((group) => group.expenses ?? []));
    } catch (error) {
      console.log('Fetch expense groups failed', error);
      setTripSections([]);
      setExpenseGroups([]);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id, setExpenseGroups, setExpenses]);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  useFocusEffect(
    useCallback(() => {
      refreshGroups();
    }, [refreshGroups])
  );

  const createGroup = async () => {
    if (!currentTrip?.id || !newGroupName.trim()) {
      return;
    }

    try {
      const response = await createExpenseGroup(currentTrip.id, { name: newGroupName.trim() });
      setExpenseGroups([...expenseGroups, response.group as ExpenseGroup]);
      setNewGroupName('');
      setGroupModalVisible(false);
    } catch (error: any) {
      Alert.alert('Group failed', error?.message || 'Could not create expense group');
    }
  };

  const groupTotal = (group: ExpenseGroup) =>
    (group.expenses ?? []).reduce((sum, expense) => sum + expense.amount, 0);
  const allTripsTotal = tripSections.reduce(
    (sum, section) => sum + section.groups.reduce((groupSum, group) => groupSum + groupTotal(group), 0),
    0
  );

  const openGroup = async (trip: CurrentTrip, group: ExpenseGroup) => {
    try {
      const details = await fetchTripDetails(trip.id);
      setCurrentTrip(details.trip);
      setCrew(details.members.map((member) => ({ id: String(member.id), name: member.name, role: member.role })));
    } catch {
      setCurrentTrip(trip);
    }
    navigation.navigate('AddExpense', { groupId: group.id });
  };

  return (
    <Screen>
      <SectionTitle title="Expenses" subtitle="Open a trip group, then add equal or custom splits." action={<NotificationBell />} />

      {loading ? (
        <AppCard>
          <ActivityIndicator size="small" color={colors.accent} />
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.oweLabel}>Total logged</Text>
        <Text style={styles.oweAmount}>${(tripSections.length > 0 ? allTripsTotal : totalExpenseAmount()).toFixed(2)}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{tripSections.reduce((sum, section) => sum + section.groups.length, 0)}</Text>
            <Text style={styles.summaryLabel}>Groups</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{expenses.length}</Text>
            <Text style={styles.summaryLabel}>Splits</Text>
          </View>
        </View>
      </AppCard>

      {tripSections.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No expense groups yet</Text>
          <Text style={styles.emptyText}>Create a trip first. Its expense group appears here automatically.</Text>
        </AppCard>
      ) : (
        tripSections.map((section) => (
          <AppCard key={section.trip.id}>
            <Text style={styles.tripHeading}>{section.trip.name}</Text>
            <Text style={styles.meta}>{section.trip.destination}</Text>
            {section.groups.map((group) => (
              <Pressable key={group.id} style={styles.groupCard} onPress={() => openGroup(section.trip, group)}>
                <View style={styles.rowBetween}>
                  <View style={styles.leftBlock}>
                    <Text style={styles.title}>{group.name}</Text>
                    <Text style={styles.meta}>
                      {(group.expenses ?? []).length} split{(group.expenses ?? []).length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={styles.amount}>${groupTotal(group).toFixed(2)}</Text>
                </View>
              </Pressable>
            ))}
          </AppCard>
        ))
      )}

      <View style={styles.actions}>
        <Pressable style={styles.cta} onPress={() => navigation.navigate('AddExpense', { groupId: expenseGroups[0]?.id })}>
          <Text style={styles.ctaText}>Add Split</Text>
        </Pressable>
        <PrimaryButton title="Create Expense Group" variant="secondary" onPress={() => setGroupModalVisible(true)} />
      </View>

      <Modal visible={groupModalVisible} transparent animationType="slide" onRequestClose={() => setGroupModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New expense group</Text>
            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group name, for example Hotel"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <PrimaryButton title="Create group" onPress={createGroup} />
            <PrimaryButton title="Cancel" variant="secondary" onPress={() => setGroupModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  oweLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  oweAmount: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  leftBlock: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tripHeading: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  groupCard: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  meta: {
    marginTop: 4,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  expensePreview: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    paddingTop: spacing.sm,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  previewAmount: {
    color: colors.accent,
    fontWeight: '800',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  actions: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: '#F8FAFC',
    padding: spacing.md,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
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
});
