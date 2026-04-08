import React, { useMemo, useState } from 'react';
import {
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

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

export default function AddExpenseScreen({ navigation }: Props) {
  const crew = useTripStore((state) => state.crew);
  const expenses = useTripStore((state) => state.expenses);
  const tripLead = useTripStore((state) => state.tripLead);
  const selectedDestination = useTripStore((state) => state.selectedDestination);
  const totalExpenseAmount = useTripStore((state) => state.totalExpenseAmount);
  const addExpense = useTripStore((state) => state.addExpense);

  const destination = selectedDestination();
  const crewList = crew.length > 0 ? crew : [];
  const payerFallback = tripLead?.name ?? crewList[0]?.name ?? 'Trip Lead';

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(payerFallback);
  const [splitMethod, setSplitMethod] = useState<'Equal split' | 'Custom split'>('Equal split');
  const [notes, setNotes] = useState('');

  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const memberCount = crewList.length > 0 ? crewList.length : 1;

  const splitPreview = useMemo(() => {
    const eachAmount = safeAmount > 0 ? Number((safeAmount / memberCount).toFixed(2)) : 0;

    const sourceMembers =
      crewList.length > 0
        ? crewList
        : [{ id: 'fallback-1', name: payerFallback }];

    return sourceMembers.map((member) => ({
      memberId: member.id,
      memberName: member.name,
      amount: eachAmount,
    }));
  }, [crewList, memberCount, payerFallback, safeAmount]);

  const handleSaveExpense = () => {
    if (!title.trim() || safeAmount <= 0) {
      return;
    }

    addExpense({
      id: `expense-${Date.now()}`,
      title: title.trim(),
      amount: Number(safeAmount.toFixed(2)),
      paidBy: paidBy.trim() || payerFallback,
      splitMethod,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      splitPreview,
    });

    navigation.navigate('TripCompletion');
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Add Expense"
          subtitle="Capture one shared cost, preview the split, and carry the trip into final completion."
        />

        <AppCard>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.eyebrow}>Trip context</Text>
              <Text style={styles.tripTitle}>
                {destination?.name ?? 'Current trip'}
              </Text>
              <Text style={styles.tripMeta}>
                {crewList.length > 0 ? `${crewList.length} crew members` : 'Crew pending'} •{' '}
                {expenses.length} logged expense{expenses.length === 1 ? '' : 's'}
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

          <TextInput
            value={paidBy}
            onChangeText={setPaidBy}
            placeholder="Paid by"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

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
                <View
                  key={option}
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                >
                  <Text
                    onPress={() => setSplitMethod(option)}
                    style={[styles.optionText, selected && styles.optionTextSelected]}
                  >
                    {option}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.helperCard}>
            <Text style={styles.helperTitle}>Current behavior</Text>
            <Text style={styles.helperText}>
              Equal split preview is live now. Custom split can stay as a UI option until backend logic is added later.
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
                <Text style={styles.previewAmount}>${item.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton title="Save Expense and Continue" onPress={handleSaveExpense} />
          <PrimaryButton
            title="Back to Itinerary"
            variant="secondary"
            onPress={() => navigation.goBack()}
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