import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { firebaseAuth } from '../config/firebase';
import { formatPhoneForFirebase, maskPhoneForOtp } from '../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

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
      const result = await firebaseAuth.signInWithPhoneNumber(formattedPhone);
      setConfirmation(result);
      setVerificationCode('');
    } catch (error: any) {
      Alert.alert(
        'Could not send code',
        error?.message || 'We could not send the OTP right now.'
      );
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
                Enter `+countrycode` for international numbers, or just the 10-digit number for the US.
              </Text>
              <TextInput
                placeholder="Phone number"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
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
              <TextInput
                placeholder="6-digit code"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
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
