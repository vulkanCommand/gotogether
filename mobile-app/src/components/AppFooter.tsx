import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { colors } from '../theme/colors';

const tabs = [
  { name: 'Home', icon: 'home-outline' },
  { name: 'Trips', icon: 'airplane-outline' },
  { name: 'Live', icon: 'navigate-outline' },
  { name: 'Expenses', icon: 'wallet-outline' },
  { name: 'Profile', icon: 'person-outline' },
] as const;

export default function AppFooter() {
  const navigation = useNavigation<any>();
  const navigationState = useNavigationState((state) => state);

  const activeTab = React.useMemo(() => {
    const currentRoute = navigationState?.routes?.[navigationState.index ?? 0];
    if (!currentRoute) {
      return '';
    }
    if (currentRoute.name === 'MainTabs' && currentRoute.state) {
      const nestedState = currentRoute.state as any;
      const nestedRoute = nestedState.routes?.[nestedState.index ?? 0];
      return nestedRoute?.name || '';
    }
    return tabs.some((tab) => tab.name === currentRoute.name) ? currentRoute.name : '';
  }, [navigationState]);

  return (
    <View style={styles.footer}>
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
    height: 84,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
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
