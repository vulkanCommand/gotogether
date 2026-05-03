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
    height: 92,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 18,
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: `0px 12px 22px ${colors.shadow}`,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.tabInactive,
  },
});
