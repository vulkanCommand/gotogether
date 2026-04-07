import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import { expenses } from '../data/mock';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export default function ExpensesScreen() {
  return (
    <Screen>
      <SectionTitle title="Expenses" subtitle="Track who paid, who owes, and what is settled." />

      <AppCard>
        <Text style={styles.oweLabel}>You owe</Text>
        <Text style={styles.oweAmount}>$42.00</Text>
      </AppCard>

      {expenses.map((item) => (
        <AppCard key={item.id}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>Paid by {item.payer}</Text>
            </View>
            <Text style={styles.amount}>{item.amount}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.split}</Text>
          </View>
        </AppCard>
      ))}

      <Pressable style={styles.cta}>
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
    alignItems: 'center',
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
});
