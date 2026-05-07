import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { fetchNotifications } from '../config/api';
import { colors } from '../theme/colors';

export default function NotificationBell() {
  const navigation = useNavigation<any>();
  const [hasNotifications, setHasNotifications] = useState(false);

  const refreshNotifications = useCallback(async () => {
    try {
      const response = await fetchNotifications();
      const items = Array.isArray(response.notifications) ? response.notifications : [];
      setHasNotifications(items.some((item) => !item.readAt));
    } catch (error) {
      console.log('Notification bell refresh failed', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshNotifications();
    }, [refreshNotifications])
  );

  return (
    <Pressable style={styles.button} onPress={() => navigation.navigate('Notifications')}>
      <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
      {hasNotifications ? <View style={styles.dot} /> : null}
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
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
