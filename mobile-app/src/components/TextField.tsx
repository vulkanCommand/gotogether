import React from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = TextInputProps & {
  label?: string;
  helper?: string;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function TextField({ label, helper, multiline = false, containerStyle, style, ...props }: Props) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={props.placeholderTextColor ?? colors.textMuted}
        style={[styles.input, multiline && styles.multiline, style]}
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
    fontWeight: '900',
    letterSpacing: 0.6,
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
    boxShadow: `0px 8px 20px ${colors.shadow}`,
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
