import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { trips } from '../data/mock';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <SectionTitle title="Good evening, Kalyan" subtitle="Your crew is almost ready for the next trip." />

      <AppCard>
        <Text style={styles.label}>Active trip</Text>
        <Text style={styles.tripTitle}>{trips[0].name}</Text>
        <Text style={styles.meta}>{trips[0].date} • {trips[0].destination}</Text>
        <View style={styles.pills}>
          <View style={styles.pill}><Text style={styles.pillText}>5 members</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>{trips[0].progress}</Text></View>
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton title="Open Trip" onPress={() => navigation.navigate('TripOverview')} />
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionHeader}>What’s next</Text>
        <Text style={styles.rowTitle}>Hotel check-in</Text>
        <Text style={styles.rowMeta}>Today • 1:00 PM</Text>
      </AppCard>

      <Pressable style={styles.cta} onPress={() => navigation.navigate('CreateGroup')}>
        <Text style={styles.ctaText}>Create Trip Group</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  tripTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pill: {
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowMeta: {
    marginTop: 4,
    color: colors.textSecondary,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
