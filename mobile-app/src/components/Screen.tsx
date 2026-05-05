import React, { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import AppFooter from './AppFooter';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showFooter?: boolean;
  showBackButton?: boolean;
};

export default function Screen({ children, scroll = true, showFooter = false, showBackButton = false }: Props) {
  const navigation = useNavigation<any>();

  const header = showBackButton ? (
    <View style={styles.headerRow}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  ) : null;

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
    >
      {header}
      {children}
    </ScrollView>
  ) : (
    <View style={styles.staticContent}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={['#F8FBFF', colors.background, colors.backgroundAccent]}
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
  },
});
