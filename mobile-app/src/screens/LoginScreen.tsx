import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { firebaseAuth } from '../config/firebase';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const sampleAccounts = [
  { email: 'abcd1@gmail.com', password: '00000000' },
  { email: 'abcd2@gmail.com', password: '00000000' },
];

export default function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(sampleAccounts[0].email);
  const [password, setPassword] = useState(sampleAccounts[0].password);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Confirm your password to create the account.');
      return;
    }

    try {
      setLoading(true);

      if (mode === 'signup') {
        await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      }
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        mode === 'signup' ? 'Sign up failed' : 'Sign in failed',
        error.message || 'Something went wrong'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <SectionTitle
        title={mode === 'signin' ? 'Welcome back' : 'Create account'}
        subtitle="Use email and password so the app works cleanly in Expo Go right now."
      />

      <AppCard>
        <View style={styles.modeRow}>
          <ModeChip
            active={mode === 'signin'}
            label="Sign in"
            onPress={() => setMode('signin')}
          />
          <ModeChip
            active={mode === 'signup'}
            label="Sign up"
            onPress={() => setMode('signup')}
          />
        </View>

        <View style={styles.form}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {mode === 'signup' ? (
            <TextInput
              placeholder="Confirm password"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          ) : null}

          <PrimaryButton
            title={
              loading
                ? mode === 'signup'
                  ? 'Creating account...'
                  : 'Signing in...'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Continue'
            }
            onPress={handleSubmit}
          />
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.helperTitle}>Quick test accounts</Text>
        <Text style={styles.helperText}>
          Tap one to autofill and sign in with the seeded app users.
        </Text>

        <View style={styles.sampleWrap}>
          {sampleAccounts.map((account) => (
            <Pressable
              key={account.email}
              style={styles.sampleChip}
              onPress={() => {
                setMode('signin');
                setEmail(account.email);
                setPassword(account.password);
                setConfirmPassword('');
              }}
            >
              <Text style={styles.sampleChipText}>{account.email}</Text>
            </Pressable>
          ))}
        </View>
      </AppCard>

      <Pressable style={styles.backLink} onPress={() => navigation.navigate('Onboarding')}>
        <Text style={styles.backLinkText}>Back to onboarding</Text>
      </Pressable>
    </Screen>
  );
}

function ModeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeChip, active && styles.modeChipActive]}>
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeChip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeChipActive: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },
  modeChipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: colors.accent,
  },
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
  helperTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  helperText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sampleWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sampleChip: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sampleChipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backLinkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
