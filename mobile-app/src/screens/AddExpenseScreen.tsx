import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export default function AddExpenseScreen() {
  return (
    <Screen>
      <SectionTitle title="Add Expense" subtitle="Split equally, custom, or by percentage." />

      <View style={styles.form}>
        <TextInput style={styles.amount} placeholder="$0.00" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" />
        <TextInput style={styles.input} placeholder="Expense title" placeholderTextColor={colors.textSecondary} />
        <TextInput style={styles.input} placeholder="Paid by" placeholderTextColor={colors.textSecondary} />
        <TextInput style={styles.input} placeholder="Split method" placeholderTextColor={colors.textSecondary} />
      </View>

      <PrimaryButton title="Save Expense" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  amount: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
  },
});
