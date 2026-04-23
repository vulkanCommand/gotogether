import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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

  return (
    <View style={styles.footer}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.name}
          style={styles.tab}
          onPress={() => navigation.navigate('MainTabs', { screen: tab.name })}
        >
          <Ionicons name={tab.icon} size={24} color={colors.tabInactive} />
          <Text style={styles.label}>{tab.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    height: 84,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.tabInactive,
  },
});
