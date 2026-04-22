import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiRequest } from '../config/api';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Expenses'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ExpensesScreen({ navigation }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const expenses = useTripStore((state) => state.expenses);
  const setExpenses = useTripStore((state) => state.setExpenses);
  const crew = useTripStore((state) => state.crew);
  const totalExpenseAmount = useTripStore((state) => state.totalExpenseAmount);
  const [loading, setLoading] = useState(false);

  const fetchExpenses = useCallback(async () => {
    if (!currentTrip?.id) {
      setExpenses([]);
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest<{ expenses: typeof expenses }>(`/api/trips/${currentTrip.id}/expenses`);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
    } catch (error) {
      console.log('Fetch expenses failed', error);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id, setExpenses]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [fetchExpenses])
  );

  const splitEstimate =
    expenses.length > 0 ? totalExpenseAmount() / Math.max(crew.length || currentTrip?.members_count || 1, 1) : 0;
  const averageExpense = expenses.length > 0 ? totalExpenseAmount() / expenses.length : 0;

  return (
    <Screen>
      <SectionTitle title="Expenses" subtitle="Track who paid, who owes, and what is settled." />

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
            <Text style={styles.summaryValue}>${splitEstimate.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Per person</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>${averageExpense.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Average expense</Text>
          </View>
        </View>
      </AppCard>

      {!currentTrip ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No trip selected</Text>
          <Text style={styles.emptyText}>Open a trip first, then add expenses to it.</Text>
        </AppCard>
      ) : expenses.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No expenses yet</Text>
          <Text style={styles.emptyText}>Add your first shared cost to start tracking expenses.</Text>
        </AppCard>
      ) : (
        expenses.map((item) => (
          <AppCard key={item.id}>
            <View style={styles.rowBetween}>
              <View style={styles.leftBlock}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>Paid by {item.paidBy || 'Trip lead'}</Text>
              </View>
              <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.splitMethod}</Text>
            </View>

            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
          </AppCard>
        ))
      )}

      <Pressable style={styles.cta} onPress={() => navigation.navigate('AddExpense')}>
        <Text style={styles.ctaText}>Add Expense</Text>
      </Pressable>
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
    fontSize: 16,
    fontWeight: '700',
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
  badge: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  notes: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
});
