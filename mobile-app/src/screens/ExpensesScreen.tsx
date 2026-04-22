import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { ExpenseGroup, useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { createExpenseGroup, fetchExpenseGroups } from '../config/api';
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
  const totalExpenseAmount = useTripStore((state) => state.totalExpenseAmount);
  const [loading, setLoading] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const refreshGroups = useCallback(async () => {
    if (!currentTrip?.id) {
      setExpenseGroups([]);
      setExpenses([]);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchExpenseGroups(currentTrip.id);
      const groups = Array.isArray(data.groups) ? data.groups : [];
      setExpenseGroups(groups as ExpenseGroup[]);
      setExpenses(groups.flatMap((group) => group.expenses ?? []));
    } catch (error) {
      console.log('Fetch expense groups failed', error);
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

  return (
    <Screen>
      <SectionTitle title="Expenses" subtitle="Open a trip group, then add equal or custom splits." />

      {loading ? (
        <AppCard>
          <ActivityIndicator size="small" color={colors.accent} />
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.oweLabel}>Total logged</Text>
        <Text style={styles.oweAmount}>${totalExpenseAmount().toFixed(2)}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{expenseGroups.length}</Text>
            <Text style={styles.summaryLabel}>Groups</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{expenses.length}</Text>
            <Text style={styles.summaryLabel}>Splits</Text>
          </View>
        </View>
      </AppCard>

      {!currentTrip ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No trip selected</Text>
          <Text style={styles.emptyText}>Open a trip first, then add expenses to it.</Text>
        </AppCard>
      ) : expenseGroups.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No expense groups yet</Text>
          <Text style={styles.emptyText}>Trip expenses will be created automatically when the backend syncs.</Text>
        </AppCard>
      ) : (
        expenseGroups.map((group) => (
          <AppCard key={group.id}>
            <Pressable onPress={() => navigation.navigate('AddExpense', { groupId: group.id })}>
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

            {(group.expenses ?? []).slice(0, 3).map((item) => (
              <View key={item.id} style={styles.expensePreview}>
                <Text style={styles.previewTitle}>{item.title}</Text>
                <Text style={styles.previewAmount}>${item.amount.toFixed(2)}</Text>
              </View>
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
