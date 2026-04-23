import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import NotificationBell from '../components/NotificationBell';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { ExpenseSplit, useTripStore } from '../store/tripStore';
import { createTripExpense, updateTripExpense } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

export default function AddExpenseScreen({ navigation, route }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const crew = useTripStore((state) => state.crew);
  const expenses = useTripStore((state) => state.expenses);
  const expenseGroups = useTripStore((state) => state.expenseGroups);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const totalExpenseAmount = useTripStore((state) => state.totalExpenseAmount);
  const addExpense = useTripStore((state) => state.addExpense);
  const updateExpense = useTripStore((state) => state.updateExpense);

  const crewList = crew.length > 0 ? crew : [];
  const defaultGroupId = route.params?.groupId ?? expenseGroups[0]?.id;
  const editingExpenseId = route.params?.expenseId;
  const editingExpense = expenses.find((expense) => expense.id === editingExpenseId);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidByUserId, setPaidByUserId] = useState(Number(crewList[0]?.id || 0));
  const [expenseGroupId, setExpenseGroupId] = useState(defaultGroupId ?? 0);
  const [linkedEventId, setLinkedEventId] = useState(route.params?.eventId ?? '');
  const [splitMethod, setSplitMethod] = useState<'Equal split' | 'Custom split'>('Equal split');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!editingExpense) {
      return;
    }
    setTitle(editingExpense.title);
    setAmount(String(editingExpense.amount));
    setPaidByUserId(editingExpense.paidByUserId ?? Number(crewList[0]?.id || 0));
    setExpenseGroupId(editingExpense.expenseGroupId ?? defaultGroupId ?? 0);
    setLinkedEventId(editingExpense.linkedEventId ?? '');
    setSplitMethod(editingExpense.splitMethod.toLowerCase().includes('custom') ? 'Custom split' : 'Equal split');
    setNotes(editingExpense.notes ?? '');
    const amounts: Record<string, string> = {};
    editingExpense.splitPreview.forEach((split) => {
      amounts[split.memberId] = String(split.amount);
    });
    setCustomAmounts(amounts);
  }, [defaultGroupId, editingExpense]);

  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const memberCount = Math.max(crewList.length, 1);

  const eventOptions = useMemo(
    () =>
      itineraryDays.flatMap((day) =>
        day.events.map((event) => ({
          id: event.id,
          label: `${day.title}: ${event.title}`,
        }))
      ),
    [itineraryDays]
  );

  const splitPreview = useMemo<ExpenseSplit[]>(() => {
    if (crewList.length === 0) {
      return [];
    }

    if (splitMethod === 'Custom split') {
      return crewList.map((member) => ({
        memberId: member.id,
        memberName: member.name,
        amount: Number(customAmounts[member.id] || 0),
      }));
    }

    const base = Math.floor((safeAmount / memberCount) * 100) / 100;
    const remainingCents = Math.round(safeAmount * 100) - Math.round(base * 100) * memberCount;
    return crewList.map((member, index) => ({
      memberId: member.id,
      memberName: member.name,
      amount: Number((base + (index < remainingCents ? 0.01 : 0)).toFixed(2)),
    }));
  }, [crewList, customAmounts, memberCount, safeAmount, splitMethod]);

  const customTotal = splitPreview.reduce((sum, split) => sum + split.amount, 0);
  const customValid = splitMethod === 'Equal split' || Math.abs(customTotal - safeAmount) <= 0.01;

  const handleSaveExpense = async () => {
    if (!currentTrip?.id) {
      Alert.alert('No trip selected', 'Open a trip before adding expenses.');
      return;
    }
    if (!title.trim() || safeAmount <= 0) {
      Alert.alert('Missing details', 'Enter a title and positive amount.');
      return;
    }
    if (crewList.length === 0) {
      Alert.alert('Crew missing', 'Trip members must load before adding a split.');
      return;
    }
    if (!customValid) {
      Alert.alert('Custom split mismatch', 'Custom split amounts must equal the expense total.');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        amount: Number(safeAmount.toFixed(2)),
        paidByUserId,
        expenseGroupId,
        linkedEventId,
        splitMethod,
        notes: notes.trim(),
        splitPreview,
      };

      const response = editingExpenseId
        ? await updateTripExpense(currentTrip.id, editingExpenseId, payload)
        : await createTripExpense(currentTrip.id, payload);

      const savedExpense = {
        id: response.expense.id,
        title: response.expense.title ?? payload.title,
        amount: response.expense.amount ?? payload.amount,
        paidBy: response.expense.paidBy ?? crewList.find((member) => Number(member.id) === paidByUserId)?.name ?? 'Trip member',
        paidByUserId: response.expense.paidByUserId ?? paidByUserId,
        expenseGroupId: response.expense.expenseGroupId ?? expenseGroupId,
        linkedEventId: response.expense.linkedEventId ?? linkedEventId,
        linkedEventTitle: response.expense.linkedEventTitle,
        linkedDayTitle: response.expense.linkedDayTitle,
        splitMethod: response.expense.splitMethod ?? splitMethod,
        notes: response.expense.notes ?? payload.notes,
        createdAt: response.expense.createdAt || new Date().toISOString(),
        splitPreview: Array.isArray(response.expense.splitPreview) ? response.expense.splitPreview : splitPreview,
      };
      if (editingExpenseId) {
        updateExpense(editingExpenseId, savedExpense);
      } else {
        addExpense(savedExpense);
      }

      navigation.navigate('MainTabs', { screen: 'Expenses' });
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save expense');
    }
  };

  return (
    <Screen showFooter>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title={editingExpenseId ? 'Edit Split' : 'Add Split'}
          subtitle="Choose the group, payer, event link, then split it equally or custom."
          action={<NotificationBell />}
        />

        <AppCard>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.eyebrow}>Trip context</Text>
              <Text style={styles.tripTitle}>{currentTrip?.name ?? 'Current trip'}</Text>
              <Text style={styles.tripMeta}>
                {crewList.length} crew members - {expenses.length} logged split{expenses.length === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.totalPill}>
              <Text style={styles.totalPillLabel}>Total</Text>
              <Text style={styles.totalPillValue}>${totalExpenseAmount().toFixed(2)}</Text>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.eyebrow}>Expense details</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Expense title" placeholderTextColor={colors.textSecondary} style={styles.input} />
          <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={colors.textSecondary} keyboardType="numeric" style={styles.input} />

          <Text style={styles.fieldLabel}>Expense group</Text>
          <View style={styles.chipRow}>
            {expenseGroups.map((group) => (
              <Chip key={group.id} label={group.name} selected={expenseGroupId === group.id} onPress={() => setExpenseGroupId(group.id)} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Paid by</Text>
          <View style={styles.chipRow}>
            {crewList.map((member) => (
              <Chip key={member.id} label={member.name} selected={paidByUserId === Number(member.id)} onPress={() => setPaidByUserId(Number(member.id))} />
            ))}
          </View>

          {eventOptions.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>Link to itinerary event</Text>
              <View style={styles.chipRow}>
                <Chip label="None" selected={!linkedEventId} onPress={() => setLinkedEventId('')} />
                {eventOptions.map((event) => (
                  <Chip key={event.id} label={event.label} selected={linkedEventId === event.id} onPress={() => setLinkedEventId(event.id)} />
                ))}
              </View>
            </>
          ) : null}

          <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.notesInput]} multiline />
        </AppCard>

        <AppCard>
          <Text style={styles.eyebrow}>Split method</Text>
          <View style={styles.optionRow}>
            {(['Equal split', 'Custom split'] as const).map((option) => (
              <Pressable key={option} onPress={() => setSplitMethod(option)} style={[styles.optionCard, splitMethod === option && styles.optionCardSelected]}>
                <Text style={[styles.optionText, splitMethod === option && styles.optionTextSelected]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          {splitMethod === 'Custom split' ? (
            <View style={styles.customList}>
              {crewList.map((member) => (
                <View key={member.id} style={styles.customRow}>
                  <Text style={styles.previewName}>{member.name}</Text>
                  <TextInput
                    value={customAmounts[member.id] ?? ''}
                    onChangeText={(value) => setCustomAmounts((current) => ({ ...current, [member.id]: value }))}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    style={styles.amountInput}
                  />
                </View>
              ))}
              <Text style={[styles.customHint, !customValid && styles.customHintError]}>
                Custom total: ${customTotal.toFixed(2)} / ${safeAmount.toFixed(2)}
              </Text>
            </View>
          ) : null}
        </AppCard>

        <AppCard>
          <View style={styles.previewHeader}>
            <View>
              <Text style={styles.eyebrow}>Split preview</Text>
              <Text style={styles.previewTitle}>${safeAmount > 0 ? safeAmount.toFixed(2) : '0.00'} total</Text>
            </View>
            <View style={styles.previewPill}>
              <Text style={styles.previewPillText}>{memberCount} people</Text>
            </View>
          </View>

          <View style={styles.previewList}>
            {splitPreview.map((item) => (
              <View key={item.memberId} style={styles.previewRow}>
                <Text style={styles.previewName}>{item.memberName}</Text>
                <Text style={styles.previewAmount}>${item.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton title={editingExpenseId ? 'Save Changes' : 'Save Expense'} onPress={handleSaveExpense} />
          <PrimaryButton title="Back to Expenses" variant="secondary" onPress={() => navigation.navigate('MainTabs', { screen: 'Expenses' })} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tripMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  totalPill: {
    backgroundColor: '#EEF4FF',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  totalPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  totalPillValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    maxWidth: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.accent,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  optionCardSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  optionTextSelected: {
    color: colors.accent,
  },
  customList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amountInput: {
    width: 110,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'right',
    color: colors.textPrimary,
  },
  customHint: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  customHintError: {
    color: colors.danger,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  previewPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  previewPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  previewList: {
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  previewName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
  },
  actions: {
    gap: spacing.sm,
  },
});
