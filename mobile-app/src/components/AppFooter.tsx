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
          height: 58 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
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
            <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
              <Ionicons name={tab.icon} size={20} color={selected ? colors.white : colors.tabInactive} />
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.floating,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.md,
    minHeight: 40,
    paddingVertical: 0,
  },
  tabSelected: {
    backgroundColor: '#F5F8FF',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.tabInactive,
    lineHeight: 12,
  },
  labelSelected: {
    color: colors.accent,
  },
});
