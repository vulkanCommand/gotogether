import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { useTripStore } from '../store/tripStore';
import { apiRequest } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

export default function AddExpenseScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const crew = useTripStore((state) => state.crew);
  const expenses = useTripStore((state) => state.expenses);
  const tripLead = useTripStore((state) => state.tripLead);
  const selectedDestination = useTripStore((state) => state.selectedDestination);
  const totalExpenseAmount = useTripStore((state) => state.totalExpenseAmount);
  const addExpense = useTripStore((state) => state.addExpense);

  const destination = selectedDestination();
  const crewList = crew.length > 0 ? crew : [];
  const fallbackPayer = tripLead?.name ?? crewList[0]?.name ?? 'Trip Lead';

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(fallbackPayer);
  const [splitMethod, setSplitMethod] = useState<'Equal split' | 'Custom split'>(
    'Equal split'
  );
  const [notes, setNotes] = useState('');

  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const memberCount = crewList.length > 0 ? crewList.length : 1;

  const payerOptions = useMemo(() => {
    if (crewList.length > 0) {
      return crewList.map((member) => member.name);
    }

    if (tripLead?.name) {
      return [tripLead.name];
    }

    return ['Trip Lead'];
  }, [crewList, tripLead]);

  const splitPreview = useMemo(() => {
    const eachAmount =
      safeAmount > 0 ? Number((safeAmount / memberCount).toFixed(2)) : 0;

    const sourceMembers =
      crewList.length > 0
        ? crewList
        : [{ id: 'fallback-1', name: fallbackPayer }];

    return sourceMembers.map((member) => ({
      memberId: member.id,
      memberName: member.name,
      amount: eachAmount,
    }));
  }, [crewList, memberCount, fallbackPayer, safeAmount]);

  const handleSaveExpense = async () => {
    if (!currentTrip?.id) {
      Alert.alert('No trip selected', 'Open a trip before adding expenses.');
      return;
    }

    if (!title.trim() || safeAmount <= 0) {
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        amount: Number(safeAmount.toFixed(2)),
        paidBy,
        splitMethod,
        notes: notes.trim(),
        splitPreview,
      };

      const response = await apiRequest<{ expense: any }>(`/api/trips/${currentTrip.id}/expenses`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      addExpense({
        id: response.expense.id,
        title: response.expense.title ?? payload.title,
        amount: response.expense.amount ?? payload.amount,
        paidBy: response.expense.paidBy ?? paidBy,
        splitMethod: response.expense.splitMethod ?? splitMethod,
        notes: response.expense.notes ?? payload.notes,
        createdAt: response.expense.createdAt || new Date().toISOString(),
        splitPreview: Array.isArray(response.expense.splitPreview)
          ? response.expense.splitPreview
          : splitPreview,
      });

      navigation.navigate('MainTabs', {
        screen: 'Expenses',
      });
    } catch (error: any) {
      console.log('Save expense failed', error);
      Alert.alert('Save failed', error?.message || 'Could not save expense');
    }
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <SectionTitle
          title="Add Expense"
          subtitle="Capture one shared cost, preview the split, and save it to the trip."
        />

        <AppCard>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.eyebrow}>Trip context</Text>
              <Text style={styles.tripTitle}>
                {currentTrip?.name ?? destination?.name ?? 'Current trip'}
              </Text>
              <Text style={styles.tripMeta}>
                {crewList.length > 0 ? `${crewList.length} crew members` : 'Crew pending'} •{' '}
                {expenses.length} logged expense{expenses.length === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.totalPill}>
              <Text style={styles.totalPillLabel}>Total</Text>
              <Text style={styles.totalPillValue}>
                ${totalExpenseAmount().toFixed(2)}
              </Text>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.eyebrow}>Expense details</Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Expense title"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Paid by</Text>
          <View style={styles.payerOptions}>
            {payerOptions.map((name, index) => {
              const selected = paidBy === name;

              return (
                <Pressable
                  key={`${name}-${index}`}
                  onPress={() => setPaidBy(name)}
                  style={[
                    styles.payerChip,
                    selected && styles.payerChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.payerChipText,
                      selected && styles.payerChipTextSelected,
                    ]}
                  >
                    {name}
                  </Text>
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
        </AppCard>

        <AppCard>
          <Text style={styles.eyebrow}>Split method</Text>

          <View style={styles.optionRow}>
            {(['Equal split', 'Custom split'] as const).map((option) => {
              const selected = splitMethod === option;

              return (
                <Pressable
                  key={option}
                  onPress={() => setSplitMethod(option)}
                  style={[
                    styles.optionCard,
                    selected && styles.optionCardSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.helperCard}>
            <Text style={styles.helperTitle}>Current behavior</Text>
            <Text style={styles.helperText}>
              Payer is now selected from the crew. Equal split preview is live now.
              Custom split can stay as a UI option until backend logic is added later.
            </Text>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.previewHeader}>
            <View>
              <Text style={styles.eyebrow}>Split preview</Text>
              <Text style={styles.previewTitle}>
                ${safeAmount > 0 ? safeAmount.toFixed(2) : '0.00'} total
              </Text>
            </View>

            <View style={styles.previewPill}>
              <Text style={styles.previewPillText}>{memberCount} people</Text>
            </View>
          </View>

          <View style={styles.previewList}>
            {splitPreview.map((item) => (
              <View key={item.memberId} style={styles.previewRow}>
                <Text style={styles.previewName}>{item.memberName}</Text>
                <Text style={styles.previewAmount}>
                  ${item.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton title="Save Expense" onPress={handleSaveExpense} />
          <PrimaryButton
            title="Back to Expenses"
            variant="secondary"
            onPress={() =>
              navigation.navigate('MainTabs', {
                screen: 'Expenses',
              })
            }
          />
        </View>
      </ScrollView>
    </Screen>
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

  payerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  payerChip: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  payerChipSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },

  payerChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  payerChipTextSelected: {
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
    justifyContent: 'center',
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

  helperCard: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  helperTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },

  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
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
