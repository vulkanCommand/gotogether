import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/Screen';
import GTBadge from '../components/GTBadge';
import GTCard from '../components/GTCard';
import GTEmptyState from '../components/GTEmptyState';
import GTSectionHeader from '../components/GTSectionHeader';
import {
  ApiNotification,
  clearAllNotifications,
  fetchNotifications,
  fetchTripDetails,
  markAllNotificationsRead,
  markNotificationRead,
} from '../config/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/tripStore';
import { colors } from '../theme/colors';
import { footerScrollPadding, radius, spacing } from '../theme/spacing';
import { formatNotificationDisplay } from '../utils/notificationDisplay';
import { mapApiMembersToCrew } from '../utils/tripFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;
type FilterKey = 'all' | 'trips' | 'expenses' | 'unread';

export default function NotificationsScreen({ navigation }: Props) {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
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
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (activeFilter === 'unread') {
        return !notification.readAt;
      }

      if (activeFilter === 'all') {
        return true;
      }

      return formatNotificationDisplay(notification).category === activeFilter;
    });
  }, [activeFilter, notifications]);

  const openTripFromNotification = async (tripId: number, destination?: 'TripOverview' | 'Itinerary' | 'Expenses') => {
    const details = await fetchTripDetails(tripId);
    const crew = mapApiMembersToCrew(details.members);

    setCurrentTrip(details.trip);
    setCrew(crew);
    setTripLead(crew.find((member) => member.role === 'lead') ?? crew[0] ?? null);

    if (destination === 'Itinerary') {
      navigation.navigate('Itinerary');
      return;
    }

    if (destination === 'Expenses') {
      navigation.navigate('MainTabs', { screen: 'Expenses' });
      return;
    }

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

      const type = String((notification.data as any)?.type || notification.type || notification.kind || '').trim().toLowerCase();
      const tripId = Number((notification.data as any)?.tripId ?? notification.tripId ?? 0);

      if (Number.isFinite(tripId) && tripId > 0) {
        if (type.includes('expense') || type.includes('settlement')) {
          await openTripFromNotification(tripId, 'Expenses');
          return;
        }

        if (type.includes('itinerary')) {
          await openTripFromNotification(tripId, 'Itinerary');
          return;
        }

        await openTripFromNotification(tripId, 'TripOverview');
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

  const handleClearAll = async () => {
    Alert.alert(
      'Clear all notifications?',
      'This removes notifications from this screen, but does not delete your trips or expenses.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllNotifications();
              setNotifications([]);
            } catch (error: any) {
              Alert.alert('Clear all failed', error?.message || 'Could not clear notifications');
            }
          },
        },
      ]
    );
  };

  return (
    <Screen showFooter showBackButton>
      <GTSectionHeader
        title="Notifications"
        subtitle="Trip updates, expense movement, and crew activity."
        actionLabel={unreadCount > 0 ? 'Mark all read' : notifications.length > 0 ? 'Clear all' : undefined}
        onPressAction={unreadCount > 0 ? handleMarkAllRead : notifications.length > 0 ? handleClearAll : undefined}
      />

      {unreadCount > 0 && notifications.length > 0 ? (
        <Pressable style={styles.clearAllLink} onPress={handleClearAll}>
          <Text style={styles.clearAllLinkText}>Clear all</Text>
        </Pressable>
      ) : null}

      <View style={styles.summaryRow}>
        <GTCard style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{unreadCount}</Text>
          <Text style={styles.summaryLabel}>Unread</Text>
        </GTCard>
        <GTCard style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{notifications.length}</Text>
          <Text style={styles.summaryLabel}>Total updates</Text>
        </GTCard>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {[
          { key: 'all', label: 'All' },
          { key: 'trips', label: 'Trips' },
          { key: 'expenses', label: 'Expenses' },
          { key: 'unread', label: 'Unread' },
        ].map((filter) => (
          <Pressable
            key={filter.key}
            style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter.key as FilterKey)}
          >
            <Text style={[styles.filterChipText, activeFilter === filter.key && styles.filterChipTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filteredNotifications.length === 0 ? (
        <GTEmptyState
          icon="notifications-off-outline"
          title="Nothing new yet"
          body="Trip updates will land here as your crew starts moving."
          actionLabel="Open trips"
          onPressAction={() => navigation.navigate('MainTabs', { screen: 'Trips' })}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadNotifications();
              }}
              tintColor={colors.accent}
            />
          }
        >
          {filteredNotifications.map((notification) => {
            const display = formatNotificationDisplay(notification);
            const unread = !notification.readAt;
            const tone =
              display.category === 'expenses'
                ? display.type.includes('settlement')
                  ? 'green'
                  : 'orange'
                : display.category === 'trips'
                  ? display.type.includes('itinerary')
                    ? 'green'
                    : 'blue'
                  : 'neutral';

            return (
              <Pressable key={notification.id} onPress={() => void handleNotificationPress(notification)}>
                <GTCard style={[styles.notificationCard, unread && styles.unreadCard]}>
                  <View style={styles.cardHeader}>
                    <GTBadge label={display.category === 'other' ? 'Update' : display.category} tone={tone} />
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.title}>{display.title}</Text>
                  <Text style={styles.body}>{display.body}</Text>
                </GTCard>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  clearAllLink: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  clearAllLinkText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 82,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '700',
  },
  summaryLabel: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterRow: {
    gap: spacing.sm,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: footerScrollPadding,
  },
  notificationCard: {
    gap: spacing.sm,
    minHeight: 96,
    padding: 16,
  },
  unreadCard: {
    borderColor: '#C7DAFF',
    backgroundColor: '#F8FBFF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
});
