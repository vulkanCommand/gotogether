import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signInWithEmailAndPassword } from 'firebase/auth';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { firebaseAuth } from '../config/firebase';
import { syncAuthenticatedUser } from '../config/api';
import { useAuthStore } from '../store/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  const handleLogin = async () => {
    try {
      setLoading(true);

      const userCredential = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password
      );

      const user = userCredential.user;
      const token = await user.getIdToken(true);

      setSession(token);
      await syncAuthenticatedUser();

      navigation.replace('MainTabs');
    } catch (error: any) {
      clearSession();
      console.log(error);
      Alert.alert('Login Failed', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <SectionTitle
        title="Welcome back"
        subtitle="Log in to continue planning with your crew."
      />

      <AppCard>
        <View style={styles.form}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <PrimaryButton
            title={loading ? 'Logging in...' : 'Continue'}
            onPress={handleLogin}
          />
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
