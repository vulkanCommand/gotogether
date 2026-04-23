import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

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
    try {
      await clearNotification(notification.id);
      setNotifications((items) => items.filter((item) => item.id !== notification.id));
    } catch (error: any) {
      Alert.alert('Clear failed', error?.message || 'Could not clear notification');
    }
  };

  const acceptOne = async (notification: ApiNotification) => {
    try {
      setAcceptingId(notification.id);
      const response = await acceptNotificationAction(notification.id);
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id
            ? { ...item, actionCompletedAt: new Date().toISOString(), requiresAction: false }
            : item
        )
      );
      Alert.alert(response.stale ? 'Task refreshed' : 'Accepted', response.stale ? 'This task is no longer pending.' : 'Your confirmation was saved.');
      await loadNotifications();
    } catch (error: any) {
      Alert.alert('Accept failed', error?.message || 'Could not accept this pending task');
    } finally {
      setAcceptingId(null);
    }
  };

  const clearAll = async () => {
    try {
      await clearAllNotifications();
      setNotifications((items) => items.filter((item) => item.requiresAction && !item.actionCompletedAt));
    } catch (error: any) {
      Alert.alert('Clear failed', error?.message || 'Could not clear notifications');
    }
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
              <View style={styles.actionDetail}>
                <Text style={styles.actionLabel}>{notification.actionLabel || 'Pending confirmation'}</Text>
                <Text style={styles.actionTarget}>{notification.targetTitle || notification.body}</Text>
              </View>
            ) : null}
            {notification.requiresAction && !notification.actionCompletedAt ? (
              <Pressable
                style={[styles.acceptButton, acceptingId === notification.id && styles.buttonDisabled]}
                onPress={() => acceptOne(notification)}
                disabled={acceptingId === notification.id}
              >
                <Text style={styles.acceptButtonText}>
                  {acceptingId === notification.id ? 'Accepting...' : 'Accept completion'}
                </Text>
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
  actionDetail: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  actionLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  actionTarget: {
    marginTop: 6,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  acceptButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: radius.lg,
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  clearButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: radius.lg,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 10,
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
