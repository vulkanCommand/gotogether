import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'PermissionsSetup'>;

export default function PermissionsSetupScreen({ navigation }: Props) {
  return (
    <Screen>
      <SectionTitle
        title="Choose permissions when you need them"
        subtitle="GoTogether works without blocking access. We only ask when a feature actually needs your contacts, location, or photos."
      />

      <AppCard style={styles.card}>
        <PermissionExplainer
          title="Contacts"
          body="Used only when you choose Find Friends or invite from your contacts."
        />
        <PermissionExplainer
          title="Location"
          body="Used only when you open Live sharing and choose to share your position."
        />
        <PermissionExplainer
          title="Photos"
          body="Used only when you upload a profile photo or a trip memory."
        />
        <PermissionExplainer
          title="Notifications"
          body="Helpful for trip updates, but in-app notifications and activity still work if you skip push."
          isLast
        />
      </AppCard>

      <PrimaryButton
        title="Continue to GoTogether"
        onPress={async () => {
          await Haptics.selectionAsync().catch(() => undefined);
          navigation.replace('MainTabs');
        }}
      />
      <PrimaryButton
        title="Open app settings"
        variant="secondary"
        onPress={() => {
          void Linking.openSettings();
        }}
      />
    </Screen>
  );
}

function PermissionExplainer({
  title,
  body,
  isLast = false,
}: {
  title: string;
  body: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.dot} />
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    marginTop: 6,
  },
  copy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  rowBody: {
    marginTop: 4,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
