import React, { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme/colors';
import { footerScrollPadding, shadows, spacing } from '../theme/spacing';
import AppFooter from './AppFooter';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showFooter?: boolean;
  showBackButton?: boolean;
};

export default function Screen({ children, scroll = true, showFooter = false, showBackButton = false }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const header = showBackButton ? (
    <View style={styles.headerRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  ) : null;

  /**
   * On mobile devices the soft keyboard can overlap input fields.  Wrapping
   * our content in a KeyboardAvoidingView causes the layout to resize
   * automatically when the keyboard appears.  We use a height-based
   * adjustment on Android because padding can leave extra space below the
   * content.  This component still renders children normally but will
   * shift the view up when editing text inputs.
   */
  const content = scroll ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          showFooter && styles.scrollContentWithFooter,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        {header}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 0}
    >
      <View style={styles.staticContent}>
        {header}
        {children}
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[...gradients.appBackground]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backdrop}
      />
      {content}
      {showFooter ? <AppFooter /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  scrollContentWithFooter: {
    paddingBottom: footerScrollPadding,
  },
  staticContent: {
    flex: 1,
    padding: spacing.lg,
  },
  headerRow: {
    marginBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
});
