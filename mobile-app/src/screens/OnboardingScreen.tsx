import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <Screen scroll={false}>
      <LinearGradient colors={[colors.accent, colors.violet]} style={styles.hero}>
        <Text style={styles.kicker}>GoTogether</Text>
        <Text style={styles.title}>Plan trips together.{'\n'}Without the chaos.</Text>
        <Text style={styles.subtitle}>
          Availability matching, destination voting, itinerary tracking, live coordination, and expenses in one place.
        </Text>
      </LinearGradient>

      <View style={styles.bottom}>
        <PrimaryButton title="Get Started" onPress={() => navigation.navigate('Login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    borderRadius: 32,
    justifyContent: 'flex-end',
    padding: spacing.xl,
    minHeight: 520,
  },
  kicker: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
    opacity: 0.95,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#EAF1FF',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  bottom: {
    paddingTop: spacing.lg,
  },
});
