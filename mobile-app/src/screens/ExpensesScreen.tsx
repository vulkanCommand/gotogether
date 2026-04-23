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
import { CurrentTrip, ExpenseGroup, ExpenseItem, useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { createExpenseGroup, deleteTripExpense, fetchExpenseGroups, fetchTripDetails, fetchTrips } from '../config/api';
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
  const removeExpense = useTripStore((state) => state.removeExpense);
  const [tripSections, setTripSections] = useState<Array<{ trip: CurrentTrip; groups: ExpenseGroup[] }>>([]);
  const [selectedTrip, setSelectedTrip] = useState<CurrentTrip | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ExpenseGroup | null>(null);
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
      if (selectedTrip?.id && selectedGroup?.id) {
        const updatedSection = sections.find((section) => section.trip.id === selectedTrip.id);
        const updatedGroup = updatedSection?.groups.find((group) => group.id === selectedGroup.id) ?? null;
        setSelectedTrip(updatedSection?.trip ?? null);
        setSelectedGroup(updatedGroup);
        if (updatedGroup) {
          setExpenseGroups(updatedSection?.groups ?? []);
          setExpenses(updatedGroup.expenses ?? []);
        }
      }
    } catch (error) {
      console.log('Fetch expense groups failed', error);
      setTripSections([]);
      setExpenseGroups([]);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id, selectedGroup?.id, selectedTrip?.id, setExpenseGroups, setExpenses]);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  useFocusEffect(
    useCallback(() => {
      refreshGroups();
    }, [refreshGroups])
  );

  const createGroup = async () => {
    const tripForGroup = selectedTrip ?? currentTrip;
    if (!tripForGroup?.id || !newGroupName.trim()) {
      return;
    }

    try {
      const response = await createExpenseGroup(tripForGroup.id, { name: newGroupName.trim() });
      setExpenseGroups([...expenseGroups, response.group as ExpenseGroup]);
      setNewGroupName('');
      setGroupModalVisible(false);
      await refreshGroups();
    } catch (error: any) {
      Alert.alert('Group failed', error?.message || 'Could not create expense group');
    }
  };

  const openGroup = async (trip: CurrentTrip, group: ExpenseGroup) => {
    try {
      const details = await fetchTripDetails(trip.id);
      setCurrentTrip(details.trip);
      setCrew(details.members.map((member) => ({ id: String(member.id), name: member.name, role: member.role })));
      setSelectedTrip(details.trip);
    } catch {
      setCurrentTrip(trip);
      setSelectedTrip(trip);
    }
    const section = tripSections.find((item) => item.trip.id === trip.id);
    const currentGroups = section?.groups ?? [group];
    setExpenseGroups(currentGroups);
    setExpenses(group.expenses ?? []);
    setSelectedGroup(group);
  };

  const openAddSplit = () => {
    if (!selectedTrip || !selectedGroup) {
      navigation.navigate('AddExpense', { groupId: expenseGroups[0]?.id });
      return;
    }
    setCurrentTrip(selectedTrip);
    setExpenseGroups(tripSections.find((section) => section.trip.id === selectedTrip.id)?.groups ?? [selectedGroup]);
    setExpenses(selectedGroup.expenses ?? []);
    navigation.navigate('AddExpense', { groupId: selectedGroup.id });
  };

  const editSplit = (expense: ExpenseItem) => {
    if (!selectedTrip || !selectedGroup) {
      return;
    }
    setCurrentTrip(selectedTrip);
    setExpenses(selectedGroup.expenses ?? []);
    navigation.navigate('AddExpense', { groupId: selectedGroup.id, expenseId: expense.id });
  };

  const deleteSplit = (expense: ExpenseItem) => {
    if (!selectedTrip?.id) {
      return;
    }
    Alert.alert('Delete split?', `Remove ${expense.title} from this expense group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTripExpense(selectedTrip.id, expense.id);
            removeExpense(expense.id);
            await refreshGroups();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete split');
          }
        },
      },
    ]);
  };

  if (selectedTrip && selectedGroup) {
    const splits = selectedGroup.expenses ?? [];
    return (
      <Screen>
        <SectionTitle
          title={selectedGroup.name}
          subtitle={`${selectedTrip.name} expense splits`}
          action={<NotificationBell />}
        />

        <View style={styles.detailHeader}>
          <Pressable style={styles.backPill} onPress={() => setSelectedGroup(null)}>
            <Text style={styles.backPillText}>Back</Text>
          </Pressable>
          <Pressable style={styles.addPill} onPress={openAddSplit}>
            <Text style={styles.addPillText}>+ Add</Text>
          </Pressable>
        </View>

        {splits.length === 0 ? (
          <AppCard>
            <Text style={styles.emptyTitle}>No splits in this group</Text>
            <Text style={styles.emptyText}>Tap + Add to create the first split for this trip group.</Text>
          </AppCard>
        ) : (
          splits.map((expense) => (
            <AppCard key={expense.id}>
              <View style={styles.rowBetween}>
                <View style={styles.leftBlock}>
                  <Text style={styles.title}>{expense.title}</Text>
                  <Text style={styles.meta}>
                    Paid by {expense.paidBy || 'Trip member'} - {expense.splitMethod}
                  </Text>
                  {expense.linkedEventTitle || expense.linkedDayTitle ? (
                    <Text style={styles.eventTag}>
                      {expense.linkedDayTitle ? `${expense.linkedDayTitle} - ` : ''}
                      {expense.linkedEventTitle}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.amount}>${expense.amount.toFixed(2)}</Text>
              </View>
              {expense.notes ? <Text style={styles.notes}>{expense.notes}</Text> : null}
              <View style={styles.splitPreview}>
                {expense.splitPreview.map((split) => (
                  <View key={`${expense.id}-${split.memberId}`} style={styles.splitRow}>
                    <Text style={styles.previewTitle}>{split.memberName}</Text>
                    <Text style={styles.previewAmount}>${split.amount.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.itemActions}>
                <Pressable style={styles.editButton} onPress={() => editSplit(expense)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => deleteSplit(expense)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </AppCard>
          ))
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle title="Expenses" subtitle="Open a trip group, then add equal or custom splits." action={<NotificationBell />} />

      {loading ? (
        <AppCard>
          <ActivityIndicator size="small" color={colors.accent} />
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.oweLabel}>Expense groups</Text>
        <Text style={styles.oweAmount}>{tripSections.reduce((sum, section) => sum + section.groups.length, 0)}</Text>
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
                  <Text style={styles.openText}>Open</Text>
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
  openText: {
    color: colors.accent,
    fontWeight: '800',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backPillText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  addPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  addPillText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  eventTag: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: radius.pill,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  notes: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  expensePreview: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    paddingTop: spacing.sm,
  },
  splitPreview: {
    marginTop: spacing.sm,
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
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editButton: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: '#EEF4FF',
    paddingVertical: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.accent,
    fontWeight: '900',
  },
  deleteButton: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: '900',
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
