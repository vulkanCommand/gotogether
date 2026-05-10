import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, typography } from '../theme/spacing';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPressAction?: () => void;
};

export default function GTSectionHeader({ title, subtitle, actionLabel, onPressAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actionLabel && onPressAction ? (
          <Pressable style={styles.action} onPress={onPressAction}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    ...typography.sectionTitle,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  action: {
    paddingVertical: 8,
  },
  actionText: {
    color: colors.accentStrong,
    fontSize: 13,
    fontWeight: '600',
  },
});
