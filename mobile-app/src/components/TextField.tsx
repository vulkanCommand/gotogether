import React from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radius, shadows, spacing } from '../theme/spacing';

type Props = TextInputProps & {
  label?: string;
  helper?: string;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function TextField({ label, helper, multiline = false, containerStyle, style, ...props }: Props) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        multiline={multiline}
        accessibilityLabel={props.accessibilityLabel ?? label}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        placeholderTextColor={props.placeholderTextColor ?? colors.textMuted}
        style={[styles.input, focused && styles.inputFocused, multiline && styles.multiline, style]}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 15,
    ...shadows.soft,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
