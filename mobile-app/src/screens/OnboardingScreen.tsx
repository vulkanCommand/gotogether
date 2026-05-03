import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { RootStackParamList } from '../navigation/AppNavigator';
import { prototypeImages } from '../utils/prototypeAssets';
import { spacing } from '../theme/spacing';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <LinearGradient colors={[colors.accent, colors.violet]} style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.content}>
        <Image source={prototypeImages.onboarding} style={styles.illustration} resizeMode="contain" />

        <Text style={styles.title}>
          Plan trips together.{'\n'}
          <Text style={styles.titleMuted}>Without the chaos.</Text>
        </Text>

        <Text style={styles.subtitle}>
          Choose the dates, set the destination, and keep the whole crew in sync from one clear trip flow.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={() => navigation.navigate('Login')} style={styles.button}>
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  illustration: {
    width: 260,
    height: 260,
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginBottom: spacing.md,
  },
  titleMuted: {
    color: 'rgba(255,255,255,0.82)',
  },
  subtitle: {
    maxWidth: 320,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
});
