import React from 'react';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export default function SectionTitle({ title, subtitle, action }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {action}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
