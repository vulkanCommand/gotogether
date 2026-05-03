import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { FirebaseAuthTypes, signInWithPhoneNumber } from '@react-native-firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import Pill from '../components/Pill';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import TextField from '../components/TextField';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { firebaseAuth } from '../config/firebase';
import { formatPhoneForFirebase, maskPhoneForOtp } from '../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

function getPhoneAuthErrorMessage(error: any) {
  const code = error?.code as string | undefined;

  if (code === 'auth/too-many-requests') {
    return 'Firebase has temporarily blocked OTP requests from this device because of too many recent attempts. Wait a while before trying again, or use a different device/number for testing.';
  }

  if (code === 'auth/invalid-phone-number') {
    return 'Enter a valid phone number with country code, or use a 10-digit US number.';
  }

  return error?.message || 'We could not send the OTP right now.';
}

export default function LoginScreen({ navigation }: Props) {
  const isExpoGo = Constants.appOwnership === 'expo';
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async () => {
    if (isExpoGo) {
      Alert.alert(
        'Development build required',
        'Phone OTP uses native Firebase auth, so this screen needs the Expo development build instead of Expo Go.'
      );
      return;
    }

    const formattedPhone = formatPhoneForFirebase(phoneNumber);
    if (!formattedPhone) {
      Alert.alert(
        'Invalid phone number',
        'Enter a valid phone number with country code, or use a 10-digit US number.'
      );
      return;
    }

    try {
      setLoading(true);
      const result = await signInWithPhoneNumber(firebaseAuth, formattedPhone);
      setConfirmation(result);
      setVerificationCode('');
    } catch (error: any) {
      Alert.alert('Could not send code', getPhoneAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmation) {
      return;
    }

    if (verificationCode.trim().length < 6) {
      Alert.alert('Enter the full code', 'Use the 6-digit OTP we sent to your phone.');
      return;
    }

    try {
      setVerifying(true);
      await confirmation.confirm(verificationCode.trim());
    } catch (error: any) {
      Alert.alert('Code verification failed', error?.message || 'The OTP code was invalid.');
    } finally {
      setVerifying(false);
    }
  };

  const resetPhoneFlow = () => {
    setConfirmation(null);
    setVerificationCode('');
  };

  return (
    <Screen>
      <LinearGradient colors={['#0F172A', '#173A75', '#2563EB']} style={styles.hero}>
        <Pill label={confirmation ? 'Secure sign-in' : 'Premium trip access'} tone="accent" />
        <Text style={styles.heroTitle}>{confirmation ? 'One step left' : 'Welcome back to the crew'}</Text>
        <Text style={styles.heroSubtitle}>
          {confirmation
            ? 'Enter the 6-digit code and we will drop you into your shared trip workspace.'
            : 'Phone-first sign-in keeps the group fast, secure, and easy to join from any device.'}
        </Text>
      </LinearGradient>

      <SectionTitle
        title={confirmation ? 'Enter OTP' : 'Continue with phone'}
        subtitle={
          confirmation
            ? `We sent a one-time code to ${maskPhoneForOtp(phoneNumber)}.`
            : 'Use your phone number to sign in or create your account with a one-time code.'
        }
      />

      <AppCard>
        <View style={styles.form}>
          {!confirmation ? (
            <>
              <Text style={styles.helperText}>
                Enter +countrycode for international numbers, or just the 10-digit number for the US.
              </Text>
              <TextField
                label="Phone number"
                placeholder="Phone number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
              />
              <PrimaryButton
                title={loading ? 'Sending code...' : 'Send OTP'}
                onPress={sendCode}
                disabled={loading}
              />
            </>
          ) : (
            <>
              <TextField
                label="Verification code"
                placeholder="6-digit code"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
              />
              <PrimaryButton
                title={verifying ? 'Verifying...' : 'Verify and continue'}
                onPress={verifyCode}
                disabled={verifying}
              />
              <PrimaryButton title="Change number" variant="secondary" onPress={resetPhoneFlow} />
              <Pressable
                style={styles.inlineLink}
                onPress={sendCode}
                disabled={loading}
              >
                <Text style={styles.inlineLinkText}>
                  {loading ? 'Sending a new code...' : 'Resend code'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </AppCard>

      {isExpoGo ? (
        <AppCard>
          <Text style={styles.helperTitle}>Use the dev build for phone login</Text>
          <Text style={styles.helperText}>
            Expo Go cannot run native Firebase phone authentication. Open the development build on your phone, then use this OTP flow there.
          </Text>
        </AppCard>
      ) : null}

      <Pressable style={styles.backLink} onPress={() => navigation.navigate('Onboarding')}>
        <Text style={styles.backLinkText}>Back to onboarding</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  heroSubtitle: {
    color: '#DBEAFE',
    fontSize: 14,
    lineHeight: 21,
  },
  form: {
    gap: spacing.md,
  },
  helperTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  inlineLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  inlineLinkText: {
    color: colors.accent,
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
