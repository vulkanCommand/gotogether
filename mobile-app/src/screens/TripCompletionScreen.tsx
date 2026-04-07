import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { members } from '../data/mock';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

export default function TripCompletionScreen() {
  return (
    <Screen>
      <SectionTitle title="Trip Completed" subtitle="Upload the group selfie and finalize the trip." />

      <View style={styles.uploadBox}>
        <Text style={styles.uploadText}>Group selfie upload area</Text>
      </View>

      <AppCard>
        {members.map((member) => (
          <Text key={member.id} style={styles.member}>• {member.name} confirmation pending</Text>
        ))}
      </AppCard>

      <PrimaryButton title="Finish Trip" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  uploadBox: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: '#E7F0FF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: colors.primary,
    fontWeight: '700',
  },
  member: {
    color: colors.textPrimary,
    marginBottom: 10,
    fontSize: 15,
  },
});
