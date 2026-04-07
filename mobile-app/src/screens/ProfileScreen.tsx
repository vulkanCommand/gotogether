import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function ProfileScreen() {
  return (
    <Screen>
      <SectionTitle title="Profile" subtitle="Your travel identity and preferences." />

      <AppCard>
        <Text style={styles.name}>Durga Kalyan</Text>
        <Text style={styles.handle}>@kalyan</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.stat}>12 trips completed</Text>
        <Text style={styles.stat}>28 friends connected</Text>
        <Text style={styles.stat}>4 groups active</Text>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  handle: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  stat: {
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
});
