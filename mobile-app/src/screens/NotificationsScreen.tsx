import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import PrimaryButton from '../components/PrimaryButton';
import SectionTitle from '../components/SectionTitle';
import {
  ApiNotification,
  acceptNotificationAction,
  clearAllNotifications,
  clearNotification,
  fetchNotifications,
} from '../config/api';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type NotificationTab = 'Pending tasks' | 'Alerts';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [activeTab, setActiveTab] = useState<NotificationTab>('Pending tasks');
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

  const pendingTasks = useMemo(
    () => notifications.filter((item) => item.requiresAction && !item.actionCompletedAt),
    [notifications]
  );
  const alerts = useMemo(
    () => notifications.filter((item) => !item.requiresAction || item.actionCompletedAt),
    [notifications]
  );
  const visibleNotifications = activeTab === 'Pending tasks' ? pendingTasks : alerts;

  const clearOne = async (notification: ApiNotification) => {
    if (notification.requiresAction && !notification.actionCompletedAt) {
      return;
    }
    await clearNotification(notification.id);
    setNotifications((items) => items.filter((item) => item.id !== notification.id));
  };

  const acceptOne = async (notification: ApiNotification) => {
    await acceptNotificationAction(notification.id);
    await loadNotifications();
  };

  const clearAll = async () => {
    await clearAllNotifications();
    setNotifications((items) => items.filter((item) => item.requiresAction && !item.actionCompletedAt));
  };

  return (
    <Screen showFooter>
      <SectionTitle title="Notifications" subtitle="Trip updates and pending confirmations." />

      <View style={styles.toggleRow}>
        {(['Pending tasks', 'Alerts'] as NotificationTab[]).map((tab) => {
          const selected = activeTab === tab;
          const count = tab === 'Pending tasks' ? pendingTasks.length : alerts.length;
          return (
            <Pressable key={tab} style={[styles.toggle, selected && styles.toggleSelected]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.toggleText, selected && styles.toggleTextSelected]}>{tab}</Text>
              <Text style={[styles.toggleCount, selected && styles.toggleTextSelected]}>{count}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <AppCard>
          <ActivityIndicator color={colors.accent} />
        </AppCard>
      ) : null}

      {activeTab === 'Alerts' ? (
        <PrimaryButton title="Clear all alerts" variant="secondary" onPress={clearAll} />
      ) : null}

      {visibleNotifications.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyTitle}>
            {activeTab === 'Pending tasks' ? 'No pending tasks' : 'No alerts'}
          </Text>
          <Text style={styles.emptyText}>
            {activeTab === 'Pending tasks'
              ? 'Event and trip completion confirmations will wait here.'
              : 'Regular trip activity will show here.'}
          </Text>
        </AppCard>
      ) : (
        visibleNotifications.map((notification) => (
          <AppCard key={notification.id}>
            <Text style={styles.kind}>{notification.kind}</Text>
            <Text style={styles.title}>{notification.title}</Text>
            <Text style={styles.body}>{notification.body}</Text>
            {notification.requiresAction && !notification.actionCompletedAt ? (
              <Pressable style={styles.acceptButton} onPress={() => acceptOne(notification)}>
                <Text style={styles.acceptButtonText}>Accept completion</Text>
              </Pressable>
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
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggle: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  toggleTextSelected: {
    color: colors.accent,
  },
  toggleCount: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
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
  acceptButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
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
