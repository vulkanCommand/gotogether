import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
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

// We removed the concept of "Pending tasks" since trip completion no longer
// requires votes. All notifications shown here are alerts, and tasks are no
// longer surfaced.  A small X icon toggles the ability to clear all alerts.

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  // Show or hide the "clear all" button.  Initially hidden until the user taps the X.
  const [showClearAll, setShowClearAll] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetchNotifications();
      setNotifications(response.notifications);
      hasLoadedRef.current = true;
    } catch (error) {
      console.log('Notifications failed', error);
      if (!hasLoadedRef.current) {
        setNotifications([]);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  // Filter only alerts; tasks requiring action are no longer displayed.
  const alerts = useMemo(
    () => notifications.filter((item) => !item.requiresAction || item.actionCompletedAt),
    [notifications]
  );

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
      setNotifications([]);
      setShowClearAll(false);
    } catch (error: any) {
      Alert.alert('Clear failed', error?.message || 'Could not clear notifications');
    }
  };

  return (
    <Screen showFooter showBackButton>
      <SectionTitle title="Notifications" subtitle="Trip updates" />

      {/* Clear toggle row: tap the X to reveal or hide the clear-all button */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => setShowClearAll((value) => !value)} style={styles.clearToggle}>
          <Text style={styles.clearToggleText}>{showClearAll ? '×' : '×'}</Text>
        </Pressable>
        {showClearAll ? (
          <Pressable onPress={clearAll} style={styles.clearAllButton}>
            <Text style={styles.clearAllButtonText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {alerts.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyTitle}>No alerts</Text>
          <Text style={styles.emptyText}>Regular trip activity will show here.</Text>
        </AppCard>
      ) : (
        alerts.map((notification) => {
          // Use targetTitle when available to prepend the event name to the title.  This
          // avoids every notification showing as “Event completed” without context.
          const displayTitle = notification.targetTitle
            ? `${notification.targetTitle} ${notification.title.toLowerCase()}`
            : notification.title;

          /**
           * Render a red delete action when swiping the notification card.  The
           * clearOne callback is invoked when the user taps the red action.  We
           * also clear the item immediately when the swipeable view is fully
           * opened for a fast gesture.
           */
          const renderRightActions = () => (
            <View style={styles.swipeActionWrap}>
              <Pressable style={styles.swipeActionButton} onPress={() => clearOne(notification)}>
                <Text style={styles.swipeActionText}>Clear</Text>
              </Pressable>
            </View>
          );

          return (
            <Swipeable
              key={notification.id}
              renderRightActions={renderRightActions}
              onSwipeableOpen={() => clearOne(notification)}
            >
              <AppCard>
                <Text style={styles.kind}>{notification.kind}</Text>
                <Text style={styles.title}>{displayTitle}</Text>
                <Text style={styles.body}>{notification.body}</Text>
              </AppCard>
            </Swipeable>
          );
        })
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

  // Additional styles for the simplified notifications UI
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  clearToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearToggleText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  clearAllButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: '#EEF4FF',
    borderColor: '#C7DAFF',
    borderWidth: 1,
  },
  clearAllButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },

  // Styles for swipe-to-clear actions.  The wrap provides a consistent
  // background for the red action button; the button itself is padded and
  // centered to align with the card height.
  swipeActionWrap: {
    justifyContent: 'center',
  },
  swipeActionButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
