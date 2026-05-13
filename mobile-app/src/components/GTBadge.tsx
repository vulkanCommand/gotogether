import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, statusTones } from '../theme/colors';
import { radius, typography } from '../theme/spacing';

type Props = {
  label: string;
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'neutral';
};

export default function GTBadge({ label, tone = 'blue' }: Props) {
  const palette = statusTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    ...typography.eyebrow,
    fontSize: 11,
  },
});
