import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const tabs = [
  { name: 'Home', icon: 'home-outline' },
  { name: 'Trips', icon: 'airplane-outline' },
  { name: 'Live', icon: 'navigate-outline' },
  { name: 'Expenses', icon: 'wallet-outline' },
  { name: 'Profile', icon: 'person-outline' },
] as const;

const findActiveTab = (state: any): string => {
  if (!state?.routes?.length) {
    return '';
  }

  const currentRoute = state.routes[state.index ?? 0];
  if (!currentRoute) {
    return '';
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

  return (
    <View
      style={[
        styles.footer,
        {
          height: 68 + Math.max(insets.bottom, 12),
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {tabs.map((tab) => {
        const selected = activeTab === tab.name;
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate('MainTabs', { screen: tab.name })}
          >
            <Ionicons name={tab.icon} size={26} color={selected ? colors.accent : colors.tabInactive} />
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
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.tabInactive,
  },
  labelSelected: {
    color: colors.accent,
  },
});
