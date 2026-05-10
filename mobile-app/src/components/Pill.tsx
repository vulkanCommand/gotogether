import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'danger';
  style?: StyleProp<ViewStyle>;
};

const toneStyles = {
  neutral: {
    wrap: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
    text: { color: colors.textSecondary },
  },
  accent: {
    wrap: { backgroundColor: colors.accentSoft, borderColor: '#CFE0FF' },
    text: { color: colors.accentStrong },
  },
  success: {
    wrap: { backgroundColor: '#EAF8F2', borderColor: '#CBEBD9' },
    text: { color: colors.success },
  },
  danger: {
    wrap: { backgroundColor: '#FEF1EF', borderColor: '#F8D0CA' },
    text: { color: colors.danger },
  },
};

export default function Pill({ label, tone = 'neutral', style }: Props) {
  return (
    <View style={[styles.wrap, toneStyles[tone].wrap, style]}>
      <Text style={[styles.text, toneStyles[tone].text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
