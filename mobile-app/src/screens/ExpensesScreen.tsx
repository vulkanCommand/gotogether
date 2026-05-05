import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NotificationBell from '../components/NotificationBell';
import PrimaryButton from '../components/PrimaryButton';
import TextField from '../components/TextField';
import AppFooter from '../components/AppFooter';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { CurrentTrip, ExpenseGroup, ExpenseItem, useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { createExpenseGroup, deleteTripExpense, fetchExpenseGroups, fetchTripDetails, fetchTrips } from '../config/api';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import {
  calculateExpenseGroupSummary,
  calculateOverallExpenseSummary,
  formatMoney,
  getExpenseImpactLabel,
  groupExpensesByMonth,
} from '../utils/expenseCalculations';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Expenses'>,
  NativeStackScreenProps<RootStackParamList>
>;

type TripSection = {
  trip: CurrentTrip;
  groups: ExpenseGroup[];
};

type DetailTab = 'Activity' | 'Balances' | 'Totals';

export default function ExpensesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const expenseGroups = useTripStore((state) => state.expenseGroups);
  const setExpenseGroups = useTripStore((state) => state.setExpenseGroups);
  const setExpenses = useTripStore((state) => state.setExpenses);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const [tripSections, setTripSections] = useState<TripSection[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('Activity');
  const [loading, setLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const refreshGroups = useCallback(async () => {
    try {
      setLoading(true);
      const tripData = await fetchTrips();
      const trips = Array.isArray(tripData.trips) ? tripData.trips : [];
      const sections = await Promise.all(
        trips.map(async (trip) => {
          const groupData = await fetchExpenseGroups(trip.id);
          return {
            trip: trip as CurrentTrip,
            groups: (groupData.groups ?? []) as ExpenseGroup[],
          };
        })
      );

      setTripSections(sections);

      const activeTripId = currentTrip?.id ?? sections[0]?.trip.id ?? null;
      const activeGroups = sections.find((section) => section.trip.id === activeTripId)?.groups ?? [];
      setExpenseGroups(activeGroups);
      setExpenses(activeGroups.flatMap((group) => group.expenses ?? []));
    } catch (error) {
      console.log('Fetch expense groups failed', error);
      setTripSections([]);
      setExpenseGroups([]);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id, setExpenseGroups, setExpenses]);

  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  useFocusEffect(
    useCallback(() => {
      void refreshGroups();
    }, [refreshGroups])
  );

  const allGroups = useMemo(() => tripSections.flatMap((section) => section.groups), [tripSections]);
  const overallSummary = useMemo(
    () => calculateOverallExpenseSummary(allGroups, [], user?.id),
    [allGroups, user?.id]
  );

  const selectedSection = useMemo(
    () => tripSections.find((section) => section.trip.id === selectedTripId) ?? null,
    [selectedTripId, tripSections]
  );
  const selectedGroup = useMemo(
    () => selectedSection?.groups.find((group) => group.id === selectedGroupId) ?? null,
    [selectedGroupId, selectedSection]
  );
  const selectedGroupSummary = useMemo(
    () => (selectedGroup ? calculateExpenseGroupSummary(selectedGroup, [], user?.id) : null),
    [selectedGroup, user?.id]
  );
  const activityGroups = useMemo(
    () => (selectedGroup ? groupExpensesByMonth(selectedGroup.expenses ?? []) : []),
    [selectedGroup]
  );

  const openGroup = async (trip: CurrentTrip, group: ExpenseGroup) => {
    try {
      const details = await fetchTripDetails(trip.id);
      setCurrentTrip(details.trip);
      setCrew(
        details.members.map((member) => ({
          id: String(member.id),
          name: member.name,
          role: member.role,
          availableDates: member.available_dates,
          leadVoteUserId: member.lead_vote_user_id,
          setupCompletedAt: member.setup_completed_at,
          isViewer: member.is_viewer,
          proposalStatus: member.proposal_status,
        }))
      );
      setSelectedTripId(details.trip.id);
    } catch (error) {
      console.log('Open expense group trip details failed', error);
      setCurrentTrip(trip);
      setSelectedTripId(trip.id);
    }

    setSelectedGroupId(group.id);
    setDetailTab('Activity');
    setExpenseGroups(tripSections.find((section) => section.trip.id === trip.id)?.groups ?? [group]);
    setExpenses(group.expenses ?? []);
  };

  const openAddExpense = () => {
    const fallbackGroup = selectedGroup ?? allGroups[0];
    navigation.navigate('AddExpense', { groupId: fallbackGroup?.id });
  };

  const editExpense = (expense: ExpenseItem) => {
    if (!selectedGroup) {
      return;
    }
    navigation.navigate('AddExpense', { groupId: selectedGroup.id, expenseId: expense.id });
  };

  const deleteExpense = (expense: ExpenseItem) => {
    if (!selectedSection?.trip.id) {
      return;
    }
    Alert.alert('Delete expense?', `Remove ${expense.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTripExpense(selectedSection.trip.id, expense.id);
            await refreshGroups();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete expense');
          }
        },
      },
    ]);
  };

  const createGroup = async () => {
    const tripForGroup = selectedSection?.trip ?? currentTrip ?? tripSections[0]?.trip;
    if (!tripForGroup?.id || !newGroupName.trim()) {
      return;
    }

    try {
      await createExpenseGroup(tripForGroup.id, { name: newGroupName.trim() });
      setNewGroupName('');
      setShowGroupModal(false);
      await refreshGroups();
    } catch (error: any) {
      Alert.alert('Group failed', error?.message || 'Could not create expense group');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 22) + 12 }]}
      >
        {selectedGroup && selectedSection && selectedGroupSummary ? (
          <>
            <View style={styles.detailHeader}>
              <Pressable style={styles.iconButton} onPress={() => setSelectedGroupId(null)}>
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </Pressable>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>{selectedGroup.name}</Text>
                <Text style={styles.headerSubtitle}>{selectedSection.trip.name}</Text>
              </View>
              <NotificationBell />
            </View>

            <View style={styles.detailHero}>
              <Text
                style={[
                  styles.balanceHeadline,
                  selectedGroupSummary.netBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
                ]}
              >
                {selectedGroupSummary.netBalance >= 0
                  ? `You are owed ${formatMoney(selectedGroupSummary.currentUserIsOwed)}`
                  : `You owe ${formatMoney(selectedGroupSummary.currentUserOwes)}`}
              </Text>
              <Text style={styles.detailMeta}>Total spent {formatMoney(selectedGroupSummary.totalSpent)}</Text>

              <View style={styles.tabRow}>
                {(['Activity', 'Balances', 'Totals'] as DetailTab[]).map((tab) => {
                  const selected = detailTab === tab;
                  return (
                    <Pressable
                      key={tab}
                      onPress={() => setDetailTab(tab)}
                      style={[styles.tabButton, selected && styles.tabButtonSelected]}
                    >
                      <Text style={[styles.tabButtonText, selected && styles.tabButtonTextSelected]}>{tab}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {detailTab === 'Activity' ? (
              activityGroups.length === 0 ? (
                <EmptyCard
                  title="No expenses yet"
                  body="Add the first expense for this trip group to start tracking who owes what."
                />
              ) : (
                activityGroups.map((month) => (
                  <View key={month.key} style={styles.sectionBlock}>
                    <Text style={styles.monthTitle}>{month.label}</Text>
                    {month.expenses.map((expense) => {
                      const date = new Date(expense.createdAt);
                      const dayNumber = Number.isNaN(date.getTime()) ? '--' : `${date.getDate()}`;
                      const dayLabel = Number.isNaN(date.getTime())
                        ? ''
                        : date.toLocaleDateString(undefined, { month: 'short' });
                      const impact = getExpenseImpactLabel(expense, user?.id);
                      return (
                        <Pressable
                          key={expense.id}
                          onLongPress={() =>
                            Alert.alert(expense.title, 'Choose an action.', [
                              { text: 'Edit', onPress: () => editExpense(expense) },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(expense) },
                              { text: 'Cancel', style: 'cancel' },
                            ])
                          }
                          style={styles.expenseRow}
                        >
                          <View style={styles.expenseDate}>
                            <Text style={styles.expenseDateMonth}>{dayLabel}</Text>
                            <Text style={styles.expenseDateDay}>{dayNumber}</Text>
                          </View>
                          <View style={styles.expenseCopy}>
                            <Text style={styles.expenseTitle}>{expense.title}</Text>
                            <Text style={styles.expenseMeta}>Paid by {expense.paidBy || 'Trip member'}</Text>
                            {impact ? <Text style={styles.expenseImpact}>{impact}</Text> : null}
                            {expense.linkedEventTitle || expense.linkedDayTitle ? (
                              <Text style={styles.expenseLinked}>
                                {expense.linkedDayTitle ? `${expense.linkedDayTitle} • ` : ''}
                                {expense.linkedEventTitle}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.expenseRight}>
                            <Text style={styles.expenseAmount}>{formatMoney(expense.amount)}</Text>
                            <Pressable onPress={() => editExpense(expense)} style={styles.rowActionButton}>
                              <Ionicons name="ellipsis-horizontal" size={16} color="#B7C0CC" />
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))
              )
            ) : null}

            {detailTab === 'Balances' ? (
              <View style={styles.sectionBlock}>
                {selectedGroupSummary.currentUserBalanceLines.length === 0 ? (
                  <EmptyCard title="No balances yet" body="Once expenses are split, who owes whom will show up here." />
                ) : (
                  selectedGroupSummary.currentUserBalanceLines.map((line, index) => {
                    const youOwe = line.fromMemberId === String(user?.id);
                    const counterpart = youOwe ? line.toMemberName : line.fromMemberName;
                    return (
                      <View key={`${line.fromMemberId}-${line.toMemberId}-${index}`} style={styles.balanceRow}>
                        <View>
                          <Text style={styles.balanceRowTitle}>
                            {youOwe ? `You owe ${counterpart}` : `${counterpart} owes you`}
                          </Text>
                          <Text style={styles.balanceRowMeta}>
                            {youOwe ? 'Settle this with the payer' : 'You paid more than your share'}
                          </Text>
                        </View>
                        <Text style={[styles.balanceRowAmount, youOwe ? styles.balanceNegative : styles.balancePositive]}>
                          {formatMoney(line.amount)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {detailTab === 'Totals' ? (
              <View style={styles.sectionBlock}>
                {selectedGroupSummary.memberTotals.map((member) => (
                  <View key={member.memberId} style={styles.totalRow}>
                    <View style={styles.totalRowCopy}>
                      <Text style={styles.totalRowName}>{member.memberName}</Text>
                      <Text style={styles.totalRowMeta}>
                        Paid {formatMoney(member.paid)} • Share {formatMoney(member.owed)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.totalRowNet,
                        member.net >= 0 ? styles.balancePositive : styles.balanceNegative,
                      ]}
                    >
                      {member.net >= 0 ? '+' : '-'}
                      {formatMoney(Math.abs(member.net))}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.overviewHeader}>
              <View>
                <Text style={styles.headerTitle}>Expenses</Text>
                <Text style={styles.headerSubtitle}>Trip expense groups and balances</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable style={styles.iconButton} onPress={() => setShowGroupModal(true)}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </Pressable>
                <NotificationBell />
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Overall summary</Text>
              <Text
                style={[
                  styles.summaryHeadline,
                  overallSummary.netBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
                ]}
              >
                {overallSummary.netBalance >= 0
                  ? `You are owed ${formatMoney(overallSummary.currentUserIsOwed)}`
                  : `You owe ${formatMoney(overallSummary.currentUserOwes)}`}
              </Text>
              <View style={styles.summaryGrid}>
                <SummaryMetric label="You owe" value={formatMoney(overallSummary.currentUserOwes)} tone="negative" />
                <SummaryMetric label="You’re owed" value={formatMoney(overallSummary.currentUserIsOwed)} tone="positive" />
                <SummaryMetric label="Net" value={formatMoney(Math.abs(overallSummary.netBalance))} tone={overallSummary.netBalance >= 0 ? 'positive' : 'negative'} />
              </View>
            </View>

            {loading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color="#2AC8A0" />
              </View>
            ) : null}

            {tripSections.length === 0 && !loading ? (
              <EmptyCard title="No expenses yet" body="Create a trip first. Its default expense group will show up here automatically." />
            ) : (
              tripSections.map((section) =>
                section.groups.map((group) => {
                  const summary = calculateExpenseGroupSummary(group, [], user?.id);
                  const previewLines = summary.currentUserBalanceLines.slice(0, 2);
                  const remainingCount = Math.max(summary.currentUserBalanceLines.length - previewLines.length, 0);
                  return (
                    <Pressable key={`${section.trip.id}-${group.id}`} onPress={() => openGroup(section.trip, group)} style={styles.groupRow}>
                      <View style={styles.groupIcon}>
                        <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
                      </View>
                      <View style={styles.groupCopy}>
                        <Text style={styles.groupName}>{group.name}</Text>
                        <Text style={styles.groupTripMeta}>
                          {section.trip.name} • {section.trip.members_count ?? 1} members • {formatMoney(summary.totalSpent)}
                        </Text>
                        {previewLines.length > 0 ? (
                          previewLines.map((line, index) => {
                            const youOwe = line.fromMemberId === String(user?.id);
                            return (
                              <Text key={`${group.id}-line-${index}`} style={styles.groupPreviewText}>
                                {youOwe ? `You owe ${line.toMemberName}` : `${line.fromMemberName} owes you`}{' '}
                                <Text style={youOwe ? styles.balanceNegative : styles.balancePositive}>
                                  {formatMoney(line.amount)}
                                </Text>
                              </Text>
                            );
                          })
                        ) : (
                          <Text style={styles.groupPreviewTextMuted}>No balances yet</Text>
                        )}
                        {remainingCount > 0 ? (
                          <Text style={styles.groupPreviewTextMuted}>Plus {remainingCount} more balance{remainingCount === 1 ? '' : 's'}</Text>
                        ) : null}
                      </View>
                      <View style={styles.groupRight}>
                        <Text
                          style={[
                            styles.groupBalance,
                            summary.netBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
                          ]}
                        >
                          {summary.netBalance >= 0 ? 'you are owed' : 'you owe'}
                        </Text>
                        <Text
                          style={[
                            styles.groupBalanceAmount,
                            summary.netBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
                          ]}
                        >
                          {formatMoney(Math.abs(summary.netBalance))}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )
            )}
          </>
        )}
      </ScrollView>

      {allGroups.length > 0 ? (
        <View style={[styles.floatingButtonWrap, { bottom: 76 + Math.max(insets.bottom, 12) }]}>
          <Pressable style={styles.floatingButton} onPress={openAddExpense}>
            <Ionicons name="receipt-outline" size={20} color="#FFFFFF" />
            <Text style={styles.floatingButtonText}>Add expense</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={showGroupModal} transparent animationType="slide" onRequestClose={() => setShowGroupModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create expense group</Text>
            <TextField
              label="Group name"
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Hotel, Food, Transport..."
            />
            <View style={styles.modalActions}>
              <PrimaryButton title="Create group" onPress={createGroup} />
              <PrimaryButton title="Cancel" variant="secondary" onPress={() => setShowGroupModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <AppFooter />
    </View>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'negative';
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === 'positive' ? styles.balancePositive : styles.balanceNegative]}>
        {value}
      </Text>
    </View>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#171A1F',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerCenter: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#8D96A5',
    fontSize: 14,
    marginTop: 4,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    borderRadius: 28,
    backgroundColor: '#20242B',
    padding: 22,
    gap: spacing.md,
  },
  summaryLabel: {
    color: '#8D96A5',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryHeadline: {
    fontSize: 28,
    fontWeight: '800',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#262B33',
    padding: 14,
  },
  metricLabel: {
    color: '#8D96A5',
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '800',
  },
  groupRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#28405E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCopy: {
    flex: 1,
  },
  groupName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  groupTripMeta: {
    marginTop: 4,
    color: '#8D96A5',
    fontSize: 12,
  },
  groupPreviewText: {
    marginTop: 6,
    color: '#D5DCE6',
    fontSize: 13,
    lineHeight: 20,
  },
  groupPreviewTextMuted: {
    marginTop: 6,
    color: '#8D96A5',
    fontSize: 13,
  },
  groupRight: {
    alignItems: 'flex-end',
  },
  groupBalance: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  groupBalanceAmount: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
  },
  balancePositive: {
    color: '#2AC8A0',
  },
  balanceNegative: {
    color: '#FF8A3D',
  },
  loaderWrap: {
    paddingVertical: spacing.sm,
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: '#20242B',
    padding: 22,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    marginTop: 8,
    color: '#8D96A5',
    fontSize: 14,
    lineHeight: 21,
  },
  detailHero: {
    borderRadius: 28,
    backgroundColor: '#20242B',
    padding: 22,
    gap: spacing.md,
  },
  balanceHeadline: {
    fontSize: 28,
    fontWeight: '800',
  },
  detailMeta: {
    color: '#B7C0CC',
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  tabButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#38404B',
    backgroundColor: '#252A32',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabButtonSelected: {
    backgroundColor: '#2AC8A0',
    borderColor: '#2AC8A0',
  },
  tabButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tabButtonTextSelected: {
    color: '#0F172A',
  },
  sectionBlock: {
    gap: spacing.md,
  },
  monthTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  expenseRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  expenseDate: {
    width: 44,
    alignItems: 'center',
  },
  expenseDateMonth: {
    color: '#8D96A5',
    fontSize: 12,
    fontWeight: '700',
  },
  expenseDateDay: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  expenseCopy: {
    flex: 1,
  },
  expenseTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  expenseMeta: {
    marginTop: 4,
    color: '#8D96A5',
    fontSize: 13,
  },
  expenseImpact: {
    marginTop: 6,
    color: '#D5DCE6',
    fontSize: 13,
  },
  expenseLinked: {
    marginTop: 6,
    color: '#2AC8A0',
    fontSize: 12,
    fontWeight: '600',
  },
  expenseRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  expenseAmount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  rowActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  balanceRowTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  balanceRowMeta: {
    marginTop: 4,
    color: '#8D96A5',
    fontSize: 12,
  },
  balanceRowAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  totalRowCopy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  totalRowName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  totalRowMeta: {
    marginTop: 4,
    color: '#8D96A5',
    fontSize: 12,
  },
  totalRowNet: {
    fontSize: 18,
    fontWeight: '800',
  },
  floatingButtonWrap: {
    position: 'absolute',
    right: 20,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#22C79A',
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 16,
    boxShadow: '0px 18px 36px rgba(34, 199, 154, 0.24)',
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalActions: {
    gap: spacing.sm,
  },
});
