import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors } from '../theme/colors';
import { radius, shadows } from '../theme/spacing';

const tabs = [
  { name: 'Home', icon: 'home-outline' },
  { name: 'Trips', icon: 'airplane-outline' },
  { name: 'Live', icon: 'navigate-outline' },
  { name: 'Expenses', icon: 'wallet-outline' },
  { name: 'Profile', icon: 'person-outline' },
] as const;

type TabName = (typeof tabs)[number]['name'];

const findActiveTab = (state: any): string => {
  if (!state?.routes?.length) {
    return '';
  }

  const currentRoute = state.routes[state.index ?? 0];

  if (!currentRoute) {
    return '';
  }

  if (currentRoute.name === 'TripOverview' || currentRoute.name === 'TripSetup' || currentRoute.name === 'Itinerary' || currentRoute.name === 'TripCompletion') {
    return 'Trips';
  }

  if (currentRoute.name === 'AddExpense') {
    return 'Expenses';
  }

  if (currentRoute.name === 'Settings') {
    return 'Profile';
  }

  if (tabs.some((tab) => tab.name === currentRoute.name)) {
    return currentRoute.name;
  }

  if (currentRoute.state) {
    const nested = findActiveTab(currentRoute.state);

    if (nested) {
      return nested;
    }
  }

  const mainTabsRoute = state.routes.find((route: any) => route.name === 'MainTabs');

  if (mainTabsRoute?.state) {
    return findActiveTab(mainTabsRoute.state);
  }

  return '';
};

export default function AppFooter() {
  const navigation = useNavigation<any>();
  const navigationState = useNavigationState((state) => state);
  const insets = useSafeAreaInsets();

  const activeTab = React.useMemo(() => {
    return findActiveTab(navigationState);
  }, [navigationState]);

  const goToTab = (tabName: TabName) => {
    Haptics.selectionAsync().catch(() => undefined);
    navigation.navigate('MainTabs', {
      screen: tabName,
    });
  };

  return (
    <View
      style={[
        styles.footer,
        {
          marginBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View style={styles.footerRow}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.name;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tab.name}
              key={tab.name}
              style={[styles.tab, selected && styles.tabSelected]}
              onPress={() => goToTab(tab.name)}
            >
              <View style={styles.tabStack}>
                <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                  <Ionicons name={tab.icon} size={20} color={selected ? colors.white : colors.tabInactive} />
                </View>
                <Text style={[styles.label, selected && styles.labelSelected]}>{tab.name}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginHorizontal: 24,
    height: 72,
    paddingHorizontal: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.floating,
  },
  footerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    height: 56,
  },
  tabSelected: {
    backgroundColor: '#F5F8FF',
  },
  tabStack: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.tabInactive,
    lineHeight: 12,
    marginTop: 1,
  },
  labelSelected: {
    color: colors.accent,
  },
});
