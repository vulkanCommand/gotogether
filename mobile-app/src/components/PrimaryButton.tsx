import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { radius, shadows, spacing } from '../theme/spacing';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export default function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
}: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.wrap, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={disabled ? ['#AFC7F7', '#A7C0F5'] : [colors.accent, colors.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, styles.primaryButton]}
        >
          <Text style={styles.primaryText}>{title}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.soft,
  },
  pressed: {
    opacity: 0.96,
    transform: [{ translateY: 1 }, { scale: 0.994 }],
  },
  disabled: {
    opacity: 0.62,
    boxShadow: 'none',
  },
  button: {
    borderRadius: radius.lg,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: radius.lg,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
