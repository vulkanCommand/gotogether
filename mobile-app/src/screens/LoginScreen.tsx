import React from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  return (
    <Screen>
      <SectionTitle title="Welcome back" subtitle="Log in to continue planning with your crew." />

      <AppCard>
        <View style={styles.form}>
          <TextInput placeholder="Email" placeholderTextColor={colors.textSecondary} style={styles.input} />
          <TextInput placeholder="Password" placeholderTextColor={colors.textSecondary} style={styles.input} secureTextEntry />
          <PrimaryButton title="Continue" onPress={() => navigation.replace('MainTabs')} />
        </View>
      </AppCard>

      <Pressable style={styles.secondary}>
        <Text style={styles.secondaryText}>Continue with Google</Text>
      </Pressable>

      <Pressable style={styles.secondary}>
        <Text style={styles.secondaryText}>Continue with Apple</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
