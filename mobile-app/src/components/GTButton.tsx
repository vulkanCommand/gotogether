import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme/colors';
import { radius, shadows, spacing } from '../theme/spacing';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  compact?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  align?: 'center' | 'left';
  numberOfLines?: number;
};

export default function GTButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  compact = false,
  loading = false,
  style,
  contentStyle,
  labelStyle,
  align = 'center',
  numberOfLines = 1,
}: Props) {
  const handlePress = async () => {
    if (disabled || loading || !onPress) {
      return;
    }

    await Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        variant === 'primary' && styles.primaryButton,
        variant !== 'primary' && variant === 'secondary' && styles.secondaryButton,
        variant !== 'primary' && variant === 'ghost' && styles.ghostButton,
        variant !== 'primary' && variant === 'danger' && styles.dangerButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={disabled || loading ? [...gradients.primaryButtonDisabled] : [...gradients.primaryButton]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.buttonFill, compact && styles.compactButton]}
        >
          <View style={[styles.content, align === 'left' && styles.contentLeft, contentStyle]}>
            {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={colors.white} /> : null}
            <Text
              numberOfLines={numberOfLines}
              style={[styles.label, compact && styles.compactLabel, styles.primaryLabel, labelStyle]}
            >
              {loading ? 'Loading...' : title}
            </Text>
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.buttonFill, compact && styles.compactButton]}>
          <View style={[styles.content, align === 'left' && styles.contentLeft, contentStyle]}>
          {icon ? (
            <Ionicons
              name={icon}
              size={compact ? 16 : 18}
              color={variant === 'danger' ? colors.danger : colors.accentStrong}
            />
          ) : null}
          <Text
            numberOfLines={numberOfLines}
            style={[
              styles.label,
              compact && styles.compactLabel,
              variant === 'danger' && styles.dangerLabel,
              labelStyle,
            ]}
          >
            {loading ? 'Loading...' : title}
          </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  compactButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  primaryButton: {
    ...shadows.floating,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostButton: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerButton: {
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#F4C7C7',
  },
  buttonFill: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 0,
  },
  contentLeft: {
    justifyContent: 'flex-start',
  },
  label: {
    color: colors.accentStrong,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  compactLabel: {
    fontSize: 13,
  },
  primaryLabel: {
    color: '#FFFFFF',
  },
  dangerLabel: {
    color: colors.danger,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  disabled: {
    opacity: 0.6,
  },
});
