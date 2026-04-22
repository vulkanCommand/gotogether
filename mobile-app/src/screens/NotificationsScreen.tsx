import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import { ApiNotification, clearAllNotifications, clearNotification, fetchNotifications } from '../config/api';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchNotifications();
      setNotifications(response.notifications);
    } catch (error) {
      console.log('Notifications failed', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const clearOne = async (notification: ApiNotification) => {
    if (notification.requiresAction) {
      return;
    }
    await clearNotification(notification.id);
    setNotifications((items) => items.filter((item) => item.id !== notification.id));
  };

  const clearAll = async () => {
    await clearAllNotifications();
    setNotifications((items) => items.filter((item) => item.requiresAction));
  };

  return (
    <Screen showFooter>
      <SectionTitle title="Notifications" subtitle="Trip changes, itinerary updates, and action-required alerts." />

      {loading ? (
        <AppCard>
          <ActivityIndicator color={colors.accent} />
        </AppCard>
      ) : null}

      <PrimaryButton title="Clear all regular notifications" variant="secondary" onPress={clearAll} />

      {notifications.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptyText}>New trip activity will show here.</Text>
        </AppCard>
      ) : (
        notifications.map((notification) => (
          <AppCard key={notification.id}>
            <Text style={styles.kind}>{notification.kind}</Text>
            <Text style={styles.title}>{notification.title}</Text>
            <Text style={styles.body}>{notification.body}</Text>
            {notification.requiresAction ? (
              <Text style={styles.locked}>Action required. This will stay until handled.</Text>
            ) : (
              <Pressable style={styles.clearButton} onPress={() => clearOne(notification)}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
            )}
          </AppCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kind: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#EEF4FF',
    color: colors.accent,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  body: {
    marginTop: 6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  locked: {
    marginTop: spacing.sm,
    color: colors.warning,
    fontWeight: '700',
  },
  clearButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  clearButtonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    color: colors.textSecondary,
  },
});
