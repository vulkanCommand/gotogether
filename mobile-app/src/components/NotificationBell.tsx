import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';

export default function NotificationBell() {
  const navigation = useNavigation<any>();

  return (
    <Pressable style={styles.button} onPress={() => navigation.navigate('Notifications')}>
      <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    boxShadow: `0px 10px 22px ${colors.shadow}`,
  },
});
