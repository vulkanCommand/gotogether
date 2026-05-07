import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import {
  ApiNotification,
  clearAllNotifications,
  clearNotification,
  fetchNotifications,
} from '../config/api';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type DisplayNotification = {
  title: string;
  body: string;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').replace(/[.]+$/g, '').trim();
}

function getNotificationTimestamp(notification: ApiNotification) {
  return (notification as any).createdAt || (notification as any).created_at || (notification as any).created_at_text || '';
}

function formatActivityTimestamp(value?: string) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const year = parsedDate.getFullYear();

  let hours = parsedDate.getHours();
  const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;

  return `${month}/${day}/${year} ${hours}:${minutes}${period}`;
}

function appendTimestamp(body: string, value?: string) {
  const timestamp = formatActivityTimestamp(value);

  if (!timestamp) {
    return body;
  }

  return `${body} ${timestamp}`;
}

function extractEventNameFromTargetTitle(targetTitle?: string) {
  if (!targetTitle) {
    return '';
  }

  const parts = targetTitle
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[parts.length - 1] || targetTitle.trim();
}

function extractEventNameFromAddedTitle(title: string) {
  const match = title.match(/^(.+?)\s+added\s+to\s+events$/i);
  return cleanText(match?.[1] || '');
}

function extractActorFromAddedBody(body: string) {
  const match = body.match(/^event\s+added\s+by\s+(.+)$/i);
  return cleanText(match?.[1] || '');
}

function normalizeNotificationDisplay(notification: ApiNotification): DisplayNotification {
  const rawTitle = cleanText(String(notification.title || ''));
  const rawBody = cleanText(String(notification.body || ''));
  const targetEventName = extractEventNameFromTargetTitle(notification.targetTitle);
  const timestampValue = getNotificationTimestamp(notification);

  const titleLower = rawTitle.toLowerCase();
  const bodyLower = rawBody.toLowerCase();

  const isEventCompleted =
    titleLower.includes('event completed') ||
    (bodyLower.includes(' marked ') && bodyLower.includes(' complete')) ||
    (bodyLower.includes(' marked ') && bodyLower.includes(' completed')) ||
    bodyLower.includes(' was completed') ||
    bodyLower.endsWith(' completed');

  if (isEventCompleted) {
    const markedCompleteMatch =
      rawBody.match(/^(.+?)\s+marked\s+(.+?)\s+complete$/i) ||
      rawBody.match(/^(.+?)\s+marked\s+(.+?)\s+completed$/i);

    if (markedCompleteMatch) {
      const actorName = cleanText(markedCompleteMatch[1] || 'Someone');
      const eventName = cleanText(markedCompleteMatch[2] || targetEventName || 'Event');

      return {
        title: `${eventName} Event Completed`,
        body: appendTimestamp(`${actorName} marked as completed`, timestampValue),
      };
    }

    const completedBodyMatch = rawBody.match(/^(.+?)\s+(?:was\s+)?completed$/i);

    if (completedBodyMatch) {
      const eventName = cleanText(completedBodyMatch[1] || targetEventName || 'Event');

      return {
        title: `${eventName} Event Completed`,
        body: appendTimestamp('Someone marked as completed', timestampValue),
      };
    }

    return {
      title: `${targetEventName || 'Event'} Event Completed`,
      body: appendTimestamp(rawBody || 'Someone marked as completed', timestampValue),
    };
  }

  const isEventAdded =
    titleLower.includes('event added') ||
    titleLower.includes('added event') ||
    titleLower.includes('new event') ||
    titleLower.includes('added to events') ||
    bodyLower.includes(' added ') ||
    bodyLower.includes(' created ') ||
    bodyLower.includes(' was added to the trip plan') ||
    bodyLower.startsWith('event added by');

  if (isEventAdded) {
    const eventNameFromTitle = extractEventNameFromAddedTitle(rawTitle);
    const actorNameFromBody = extractActorFromAddedBody(rawBody);

    if (eventNameFromTitle || actorNameFromBody) {
      return {
        title: `${eventNameFromTitle || targetEventName || 'Event'} added to Events`,
        body: appendTimestamp(`Event added by ${actorNameFromBody || 'You'}`, timestampValue),
      };
    }

    const wasAddedMatch = rawBody.match(/^(.+?)\s+was\s+added\s+to\s+the\s+trip\s+plan$/i);

    if (wasAddedMatch) {
      const eventName = cleanText(wasAddedMatch[1] || targetEventName || 'Event');

      return {
        title: `${eventName} added to Events`,
        body: appendTimestamp('Event added by You', timestampValue),
      };
    }

    const addedByPersonMatch =
      rawBody.match(/^(.+?)\s+added\s+(.+?)(?:\s+to\s+.+)?$/i) ||
      rawBody.match(/^(.+?)\s+created\s+(.+?)(?:\s+to\s+.+|\s+on\s+.+|\s+for\s+.+)?$/i);

    if (addedByPersonMatch) {
      const actorName = cleanText(addedByPersonMatch[1] || 'You');
      const eventName = cleanText(addedByPersonMatch[2] || targetEventName || 'Event');

      return {
        title: `${eventName} added to Events`,
        body: appendTimestamp(`Event added by ${actorName}`, timestampValue),
      };
    }

    return {
      title: `${targetEventName || rawTitle || 'Event'} added to Events`,
      body: appendTimestamp('Event added by You', timestampValue),
    };
  }

  return {
    title: rawTitle || 'Trip activity',
    body: appendTimestamp(rawBody || 'New activity was added', timestampValue),
  };
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [showClearAll, setShowClearAll] = useState(false);
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

      <View style={styles.headerRow}>
        <Pressable onPress={() => setShowClearAll((value) => !value)} style={styles.clearToggle}>
          <Text style={styles.clearToggleText}>×</Text>
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
          const display = normalizeNotificationDisplay(notification);

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
                <Text style={styles.title}>{display.title}</Text>
                <Text style={styles.body}>{display.body}</Text>
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