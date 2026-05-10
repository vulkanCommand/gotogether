import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { FirebaseAuthTypes, signInWithPhoneNumber } from '@react-native-firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import Pill from '../components/Pill';
import PrimaryButton from '../components/PrimaryButton';
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
      <View style={styles.layout}>
        <LinearGradient colors={[colors.accent, colors.violet]} style={styles.hero}>
          <View style={styles.glowTop} />
          <View style={styles.glowBottom} />
          <Pill label={confirmation ? 'Secure sign-in' : 'Trip access'} tone="accent" style={styles.heroPill} />
          <Text style={styles.heroTitle}>
            {confirmation ? 'Enter verification code' : 'Continue with phone'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {confirmation
              ? `Sent to ${maskPhoneForOtp(phoneNumber)}.`
              : 'We’ll send a one-time code to verify your number.'}
          </Text>
        </LinearGradient>

        <AppCard style={styles.formCard}>
          <View style={styles.form}>
          {!confirmation ? (
            <>
              <Text style={styles.formIntro}>
                Enter +countrycode for international numbers, or use a 10-digit US number.
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
                title={loading ? 'Sending code...' : 'Send code'}
                onPress={sendCode}
                disabled={loading}
              />
              <Pressable style={styles.backLinkInline} onPress={() => navigation.navigate('Onboarding')}>
                <Text style={styles.backLinkInlineText}>Back to onboarding</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.formIntro}>
                Use the 6-digit code we sent to your selected phone number.
              </Text>
              <TextInput
                style={styles.otpInput}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
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
              <View style={styles.otpActions}>
                <Pressable style={styles.inlineLink} onPress={sendCode} disabled={loading}>
                  <Text style={styles.inlineLinkText}>
                    {loading ? 'Sending a new code...' : 'Resend code'}
                  </Text>
                </Pressable>
                <Pressable style={styles.inlineLink} onPress={resetPhoneFlow}>
                  <Text style={styles.inlineLinkText}>Change number</Text>
                </Pressable>
              </View>
              <Pressable style={styles.backLinkInline} onPress={() => navigation.navigate('Onboarding')}>
                <Text style={styles.backLinkInlineText}>Back to onboarding</Text>
              </Pressable>
            </>
          )}
          </View>
        </AppCard>
      </View>

      {isExpoGo ? (
        <AppCard>
          <Text style={styles.helperTitle}>Use the dev build for phone login</Text>
          <Text style={styles.helperText}>
            Expo Go cannot run native Firebase phone authentication. Open the development build on your phone, then use this OTP flow there.
          </Text>
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: 22,
    gap: spacing.sm,
    overflow: 'hidden',
    minHeight: 188,
    justifyContent: 'flex-end',
  },
  glowTop: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -56,
    left: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 21,
  },
  formCard: {
    padding: spacing.lg,
  },
  form: {
    gap: spacing.md,
  },
  formIntro: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  otpInput: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 6,
    paddingHorizontal: 18,
  },
  helperTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    flex: 1,
  },
  inlineLinkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  otpActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backLinkInline: {
    alignItems: 'center',
    paddingTop: 4,
  },
  backLinkInlineText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
