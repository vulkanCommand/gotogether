import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionTitle from '../components/SectionTitle';
import {
  ApiNotification,
  fetchNotifications,
  fetchTripDetails,
  markAllNotificationsRead,
  markNotificationRead,
} from '../config/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { mapApiMembersToCrew } from '../utils/tripFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

type DisplayNotification = {
  title: string;
  body: string;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').replace(/[.]+$/g, '').trim();
}

function getNotificationTimestamp(notification: ApiNotification) {
  return notification.createdAt || '';
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
  return timestamp ? `${body} ${timestamp}` : body;
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

function normalizeNotificationDisplay(notification: ApiNotification): DisplayNotification {
  const rawTitle = cleanText(String(notification.title || ''));
  const rawBody = cleanText(String(notification.body || ''));
  const targetEventName = extractEventNameFromTargetTitle(notification.targetTitle);
  const timestampValue = getNotificationTimestamp(notification);
  const type = String((notification.data as any)?.type || notification.type || notification.kind || '').toLowerCase();

  if (type === 'trip_added') {
    return {
      title: rawTitle || 'You were added to a trip',
      body: appendTimestamp(rawBody || 'A trip invite is waiting for you', timestampValue),
    };
  }

  const titleLower = rawTitle.toLowerCase();
  const bodyLower = rawBody.toLowerCase();
  const isEventCompleted =
    titleLower.includes('event completed') ||
    (bodyLower.includes(' marked ') && bodyLower.includes(' complete')) ||
    (bodyLower.includes(' marked ') && bodyLower.includes(' completed')) ||
    bodyLower.includes(' was completed') ||
    bodyLower.endsWith(' completed');

  if (isEventCompleted) {
    return {
      title: `${targetEventName || 'Event'} Event Completed`,
      body: appendTimestamp(rawBody || 'Someone marked as completed', timestampValue),
    };
  }

  return {
    title: rawTitle || 'Trip activity',
    body: appendTimestamp(rawBody || 'New activity was added', timestampValue),
  };
}

export default function NotificationsScreen({ navigation }: Props) {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const hasLoadedRef = useRef(false);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetchNotifications();
      setNotifications(Array.isArray(response.notifications) ? response.notifications : []);
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

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  const openTripFromNotification = async (tripId: number) => {
    const details = await fetchTripDetails(tripId);
    const crew = mapApiMembersToCrew(details.members);

    setCurrentTrip(details.trip);
    setCrew(crew);
    setTripLead(crew.find((member) => member.role === 'lead') ?? crew[0] ?? null);

    navigation.navigate(details.trip.completed_at ? 'TripCompletion' : 'TripOverview');
  };

  const handleNotificationPress = async (notification: ApiNotification) => {
    try {
      if (!notification.readAt) {
        await markNotificationRead(notification.id);
        setNotifications((items) =>
          items.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
        );
      }

      const type = String((notification.data as any)?.type || notification.type || notification.kind || '').trim();
      const tripId = Number((notification.data as any)?.tripId ?? notification.tripId ?? 0);
      if (type === 'trip_added' && Number.isFinite(tripId) && tripId > 0) {
        await openTripFromNotification(tripId);
      }
    } catch (error: any) {
      Alert.alert('Open failed', error?.message || 'Could not open notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || now })));
    } catch (error: any) {
      Alert.alert('Mark all read failed', error?.message || 'Could not update notifications');
    }
  };

  return (
    <Screen showFooter showBackButton>
      <SectionTitle title="Notifications" subtitle="Trip updates and activity." />

      <View style={styles.headerRow}>
        <Text style={styles.countText}>{unreadCount} unread</Text>
        <Pressable onPress={handleMarkAllRead} style={styles.markAllButton}>
          <Text style={styles.markAllButtonText}>Mark all read</Text>
        </Pressable>
      </View>

      {notifications.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyTitle}>Nothing new yet</Text>
          <Text style={styles.emptyText}>Trip updates will land here as your crew starts moving.</Text>
        </AppCard>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {notifications.map((notification) => {
            const display = normalizeNotificationDisplay(notification);
            const unread = !notification.readAt;

            return (
              <Pressable key={notification.id} onPress={() => handleNotificationPress(notification)}>
                <AppCard style={unread ? styles.unreadCard : undefined}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.kind}>{notification.type || notification.kind}</Text>
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.title}>{display.title}</Text>
                  <Text style={styles.body}>{display.body}</Text>
                </AppCard>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  countText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  markAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  markAllButtonText: {
    color: colors.accentStrong,
    fontWeight: '700',
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  unreadCard: {
    borderColor: '#C7DAFF',
    backgroundColor: '#F8FBFF',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
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
});
