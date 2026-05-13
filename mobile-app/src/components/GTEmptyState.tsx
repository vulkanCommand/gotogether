import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GTButton from './GTButton';
import GTCard from './GTCard';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onPressAction?: () => void;
};

export default function GTEmptyState({ icon, title, body, actionLabel, onPressAction }: Props) {
  return (
    <GTCard style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={24} color={colors.accentStrong} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onPressAction ? (
        <GTButton title={actionLabel} variant="ghost" compact onPress={onPressAction} />
      ) : null}
    </GTCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
});
