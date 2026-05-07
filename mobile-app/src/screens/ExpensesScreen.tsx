import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { CurrentTrip, ExpenseGroup, ExpenseItem, useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { createExpenseGroup, createTripExpense, deleteTripExpense, fetchExpenseGroups, fetchTripDetails, fetchTrips } from '../config/api';
import {
  calculateExpenseGroupSummary,
  calculateOverallExpenseSummary,
  formatMoney,
  getExpenseGroupDisplayName,
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

const palette = {
  screen: '#F3F6FB',
  panel: '#FFFFFF',
  panelSoft: '#F8FAFD',
  blueHero: '#2563EB',
  blueHeroDark: '#1D4ED8',
  text: '#0F172A',
  textMuted: '#667085',
  line: '#DEE7F2',
  teal: '#2563EB',
  tealSoft: '#E7F0FF',
  orange: '#EA580C',
  border: '#DEE7F2',
  modalOverlay: 'rgba(15, 23, 42, 0.25)',
  white: '#FFFFFF',
};

// Extend the BalanceLine type locally for ease of reference.  This matches the
// definition in utils/expenseCalculations.ts but avoids an additional import.
type BalanceLine = {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
};

const groupIcons = ['document-text-outline', 'home-outline', 'airplane-outline', 'wallet-outline'];
const groupIconColors = ['#134E7A', '#145C43', '#A44B12', '#7A1748'];

export default function ExpensesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const crew = useTripStore((state) => state.crew);
  const setExpenseGroups = useTripStore((state) => state.setExpenseGroups);
  const setExpenses = useTripStore((state) => state.setExpenses);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);

  const [tripSections, setTripSections] = useState<TripSection[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [settling, setSettling] = useState(false);

  // Show a modal to choose which person to settle with.  When visible the user
  // selects from one of the current balance lines, then chooses the payment
  // method.
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedSettleLine, setSelectedSettleLine] = useState<BalanceLine | null>(null);

  // Search modal state to allow filtering groups when tapping the search icon.
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    () => calculateOverallExpenseSummary(allGroups, crew, user?.id),
    [allGroups, crew, user?.id]
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
    () => (selectedGroup ? calculateExpenseGroupSummary(selectedGroup, crew, user?.id) : null),
    [crew, selectedGroup, user?.id]
  );
  const activityGroups = useMemo(
    () => (selectedGroup ? groupExpensesByMonth(selectedGroup.expenses ?? []) : []),
    [selectedGroup]
  );

  const openGroup = async (trip: CurrentTrip, group: ExpenseGroup) => {
    let latestGroups = tripSections.find((section) => section.trip.id === trip.id)?.groups ?? [group];
    try {
      const details = await fetchTripDetails(trip.id);
      const groupData = await fetchExpenseGroups(trip.id);
      latestGroups = (groupData.groups ?? []) as ExpenseGroup[];
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
      setTripSections((current) =>
        current.map((section) => (section.trip.id === trip.id ? { ...section, groups: latestGroups } : section))
      );
    } catch (error) {
      console.log('Open expense group trip details failed', error);
      setCurrentTrip(trip);
      setSelectedTripId(trip.id);
    }

    setSelectedGroupId(group.id);
    setExpenseGroups(latestGroups);
    setExpenses((latestGroups.find((item) => item.id === group.id)?.expenses ?? group.expenses) ?? []);
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
    const tripForGroup =
      selectedSection?.trip ??
      (tripSections.length === 1 ? tripSections[0]?.trip : null) ??
      (currentTrip && tripSections.some((section) => section.trip.id === currentTrip.id) ? currentTrip : null);

    if (!tripForGroup?.id || !newGroupName.trim()) {
      Alert.alert('Choose a trip first', 'Open a trip expense group first, then create another group inside that trip.');
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

  const createSettlement = async (method: 'Cash' | 'Card') => {
    if (!selectedSection?.trip.id || !selectedGroup || !selectedGroupSummary || settling) {
      return;
    }

    const lines = selectedGroupSummary.currentUserBalanceLines;
    if (lines.length === 0) {
      Alert.alert('Nothing to settle', 'You are already settled in this group.');
      return;
    }

    try {
      setSettling(true);
      const userKey = String(user?.id ?? '');

      for (const line of lines) {
        const userOwes = line.fromMemberId === userKey;
        const payerId = Number(userOwes ? line.fromMemberId : line.toMemberId);
        const receiverId = userOwes ? line.toMemberId : line.fromMemberId;
        const receiverName = userOwes ? line.toMemberName : line.fromMemberName;
        const payerName = userOwes ? line.fromMemberName : line.toMemberName;

        await createTripExpense(selectedSection.trip.id, {
          title: userOwes ? `Settlement to ${receiverName}` : `Settlement from ${payerName}`,
          amount: line.amount,
          paidByUserId: payerId,
          expenseGroupId: selectedGroup.id,
          linkedEventId: '',
          splitMethod: `Settlement - ${method}`,
          notes: `Settled by ${method.toLowerCase()}`,
          splitPreview: [
            {
              memberId: String(receiverId),
              memberName: receiverName,
              amount: line.amount,
            },
          ],
        });
      }

      await refreshGroups();
      Alert.alert('Settled', `Balance cleared using ${method}.`);
    } catch (error: any) {
      Alert.alert('Settle up failed', error?.message || 'Could not settle this balance.');
    } finally {
      setSettling(false);
    }
  };

  const handleSettleUp = () => {
    if (!selectedGroupSummary || selectedGroupSummary.currentUserBalanceLines.length === 0) {
      Alert.alert('Nothing to settle', 'You are already settled in this group.');
      return;
    }
    // Instead of paying everyone at once, allow the user to select a specific
    // balance line.  Opening the settle modal presents a list of members the
    // user either owes or is owed by.
    setShowSettleModal(true);
  };

  // Create a single settlement for a specific balance line.  This mirrors the
  // existing createSettlement implementation but only applies to one line.
  const createSingleSettlement = async (line: BalanceLine, method: 'Cash' | 'Card') => {
    if (!selectedSection?.trip.id || !selectedGroup || settling) {
      return;
    }
    try {
      setSettling(true);
      // Determine whether the current user is the debtor or creditor.
      const userKey = String(user?.id ?? '');
      const userOwes = line.fromMemberId === userKey;
      const payerId = userOwes ? Number(line.fromMemberId) : Number(line.toMemberId);
      const receiverId = userOwes ? line.toMemberId : line.fromMemberId;
      const receiverName = userOwes ? line.toMemberName : line.fromMemberName;
      const payerName = userOwes ? line.fromMemberName : line.toMemberName;

      await createTripExpense(selectedSection.trip.id, {
        title: userOwes ? `Settlement to ${receiverName}` : `Settlement from ${payerName}`,
        amount: line.amount,
        paidByUserId: payerId,
        expenseGroupId: selectedGroup.id,
        linkedEventId: '',
        splitMethod: `Settlement - ${method}`,
        notes: `Settled by ${method.toLowerCase()}`,
        splitPreview: [
          {
            memberId: String(receiverId),
            memberName: receiverName,
            amount: line.amount,
          },
        ],
      });
      await refreshGroups();
      Alert.alert('Settled', `Balance with ${receiverName} cleared using ${method}.`);
    } catch (error: any) {
      Alert.alert('Settle up failed', error?.message || 'Could not settle this balance.');
    } finally {
      setSettling(false);
    }
  };

  const renderOverview = () => (
    <>
      <View style={styles.topRow}>
        <Pressable
          style={styles.circleButton}
          onPress={() => {
            // Open a search modal when tapping the search icon instead of refreshing
            setSearchQuery('');
            setShowSearchModal(true);
          }}
        >
          <Ionicons name="search-outline" size={24} color={palette.text} />
        </Pressable>
        <Pressable onPress={() => setShowGroupModal(true)}>
          <Text style={styles.createGroupText}>Create group</Text>
        </Pressable>
      </View>

      <View style={styles.overallHeaderRow}>
        <Text style={styles.overallHeaderText}>
          {overallSummary.netBalance >= 0 ? 'Overall, you are owed ' : 'Overall, you owe '}
          <Text style={overallSummary.netBalance >= 0 ? styles.positiveText : styles.negativeText}>
            {formatMoney(Math.abs(overallSummary.netBalance))}
          </Text>
        </Text>
        <Pressable style={styles.circleButton} onPress={() => void refreshGroups()}>
          {loading ? <ActivityIndicator color={palette.text} /> : <Ionicons name="options-outline" size={22} color={palette.text} />}
        </Pressable>
      </View>

      <View style={styles.groupList}>
        {allGroups.map((group, index) => {
          const section = tripSections.find((item) => item.groups.some((candidate) => candidate.id === group.id));
          if (!section) {
            return null;
          }

          const groupSummary = calculateExpenseGroupSummary(group, crew, user?.id);
          const previewLines = buildPreviewLines(groupSummary, user?.id);
          const isPositive = groupSummary.netBalance >= 0;

          return (
            <Pressable key={group.id} style={styles.groupRow} onPress={() => openGroup(section.trip, group)}>
              <GroupAvatar index={index} />
              <View style={styles.groupCenter}>
                <Text style={styles.groupName}>{getExpenseGroupDisplayName(group.name, section.trip.name)}</Text>
                {previewLines.length > 0 ? (
                  previewLines.map((line) => (
                    <Text key={line} style={styles.groupSubline} numberOfLines={1}>
                      {line}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.groupSubline}>No balances yet</Text>
                )}
              </View>
              <View style={styles.groupRight}>
                <Text style={styles.groupBalanceLabel}>Total spent</Text>
                <Text style={styles.groupBalanceAmount}>{formatMoney(groupSummary.totalSpent)}</Text>
              </View>
            </Pressable>
          );
        })}

        {!loading && allGroups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No expense groups yet</Text>
            <Text style={styles.emptyText}>Create a group and start adding trip expenses.</Text>
          </View>
        ) : null}
      </View>
    </>
  );

  const renderDetail = () => {
    if (!selectedGroup || !selectedSection || !selectedGroupSummary) {
      return null;
    }

    const balancePositive = selectedGroupSummary.netBalance >= 0;
    const memberCount = Math.max(selectedSection.trip.members_count ?? 0, selectedGroupSummary.memberTotals.length);

    return (
      <>
        <View style={[styles.hero, { paddingTop: Math.max(insets.top, 14) + 8 }]}>
          <View style={styles.heroActionsRow}>
            <Pressable style={styles.heroIconButton} onPress={() => setSelectedGroupId(null)}>
              <Ionicons name="chevron-back" size={24} color={palette.white} />
            </Pressable>
          </View>

          <Text style={styles.heroTitle}>{getExpenseGroupDisplayName(selectedGroup.name, selectedSection.trip.name)}</Text>
          <View style={styles.heroMemberPill}>
            <Ionicons name="people-outline" size={16} color={palette.white} />
            <Text style={styles.heroMemberText}>{memberCount} people</Text>
          </View>
        </View>

        <View style={styles.detailBody}>
          <Text style={styles.detailHeadline}>
            {balancePositive ? 'You are owed ' : 'You owe '}
            <Text style={balancePositive ? styles.positiveText : styles.negativeText}>
              {formatMoney(balancePositive ? selectedGroupSummary.currentUserIsOwed : selectedGroupSummary.currentUserOwes)}
            </Text>
          </Text>

          <View style={styles.detailSummaryRow}>
            <MetricPill label="Total spent" value={formatMoney(selectedGroupSummary.totalSpent)} />
            <MetricPill label="Balances" value={`${selectedGroupSummary.currentUserBalanceLines.length}`} />
          </View>

          <Pressable style={[styles.settleButton, settling && styles.settleButtonDisabled]} onPress={handleSettleUp} disabled={settling}>
            <Text style={styles.settleButtonText}>{settling ? 'Settling...' : 'Settle up'}</Text>
          </Pressable>

          <View style={styles.activitySection}>
            {activityGroups.map((monthGroup) => (
              <View key={monthGroup.key} style={styles.monthBlock}>
                <Text style={styles.monthLabel}>{monthGroup.label}</Text>
                {monthGroup.expenses.map((expense, index) => {
                  const impact = getExpenseImpactLabel(expense, user?.id);
                  const tonePositive = impact.toLowerCase().includes('paid');
                  return (
                    <Pressable
                      key={expense.id}
                      style={[styles.activityRow, index === monthGroup.expenses.length - 1 && styles.activityRowLast]}
                      onLongPress={() =>
                        Alert.alert(expense.title, 'Choose an action', [
                          { text: 'Edit', onPress: () => editExpense(expense) },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(expense) },
                          { text: 'Cancel', style: 'cancel' },
                        ])
                      }
                    >
                      <View style={styles.activityDateWrap}>
                        <Text style={styles.activityDateMonth}>{formatActivityMonth(expense.createdAt)}</Text>
                        <Text style={styles.activityDateDay}>{formatActivityDay(expense.createdAt)}</Text>
                      </View>

                      <View style={styles.activityIconWrap}>
                        <Ionicons name="cash-outline" size={19} color={palette.teal} />
                      </View>

                      <View style={styles.activityContent}>
                        <Text style={styles.activityTitle}>{expense.title}</Text>
                        <Text style={styles.activitySubtitle} numberOfLines={2}>
                          {impact || `${expense.paidBy} paid ${formatMoney(expense.amount)}`}
                        </Text>
                      </View>

                      <View style={styles.activityAmountWrap}>
                        <Text style={[styles.activityAmount, tonePositive ? styles.positiveText : styles.negativeText]}>
                          {formatMoney(expense.amount)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {activityGroups.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptyText}>Add your first expense for this group.</Text>
              </View>
            ) : null}
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 96 }}
      >
        {selectedGroup ? renderDetail() : <View style={[styles.content, { paddingTop: Math.max(insets.top, 22) + 8 }]}>{renderOverview()}</View>}
      </ScrollView>

      {(!selectedGroup || selectedSection) && (
        <View pointerEvents="box-none" style={styles.floatingActionWrap}>
          <Pressable style={[styles.floatingAction, { bottom: Math.max(insets.bottom, 18) + 8 }]} onPress={openAddExpense}>
            <Ionicons name="receipt-outline" size={22} color={palette.white} />
            <Text style={styles.floatingActionText}>Add expense</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={showGroupModal} transparent animationType="fade" onRequestClose={() => setShowGroupModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create group</Text>
            <Text style={styles.modalSubtitle}>Add another expense group inside the selected trip.</Text>
            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Weekend food"
              placeholderTextColor={palette.textMuted}
              style={styles.modalInput}
            />
            <View style={styles.modalButtonsRow}>
              <Pressable style={styles.modalSecondaryButton} onPress={() => setShowGroupModal(false)}>
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={() => void createGroup()}>
                <Text style={styles.modalPrimaryButtonText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal to choose which balance line to settle.  Lists all balances
          involving the current user.  Once a line is selected, the user is
          prompted to choose the payment method. */}
      <Modal
        visible={showSettleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settleModalCard}>
            <Text style={styles.modalTitle}>Select person to settle with</Text>
            {selectedGroupSummary?.currentUserBalanceLines?.map((line) => {
              const userKey = String(user?.id ?? '');
              const userOwes = line.fromMemberId === userKey;
              const personName = userOwes ? line.toMemberName : line.fromMemberName;
              const descriptor = userOwes
                ? `You owe ${formatMoney(line.amount)} to ${personName}`
                : `${personName} owes you ${formatMoney(line.amount)}`;
              return (
                <Pressable
                  key={`${line.fromMemberId}-${line.toMemberId}`}
                  onPress={() => {
                    setShowSettleModal(false);
                    setSelectedSettleLine(line);
                    Alert.alert(
                      `Settle with ${personName}`,
                      'How was this paid?',
                      [
                        { text: 'Cash', onPress: () => void createSingleSettlement(line, 'Cash') },
                        { text: 'Card', onPress: () => void createSingleSettlement(line, 'Card') },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }}
                  style={styles.settleRow}
                >
                  <Text style={styles.settleRowText}>{descriptor}</Text>
                </Pressable>
              );
            })}
            {(!selectedGroupSummary || selectedGroupSummary.currentUserBalanceLines.length === 0) ? (
              <Text style={styles.emptyText}>No balances to settle.</Text>
            ) : null}
            <Pressable style={styles.modalSecondaryButton} onPress={() => setShowSettleModal(false)}>
              <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal for searching expense groups.  Provides a text input and shows
          filtered results across all groups. */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalCard}>
            <Text style={styles.modalTitle}>Search groups</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by group or trip"
              placeholderTextColor={palette.textMuted}
              style={styles.modalInput}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
              keyboardShouldPersistTaps="handled"
            >
              {allGroups
                .filter((group) => {
                  const trip = tripSections.find((sec) => sec.groups.some((g) => g.id === group.id))?.trip;
                  const query = searchQuery.trim().toLowerCase();
                  if (!query) return true;
                  const groupName = getExpenseGroupDisplayName(group.name, trip?.name).toLowerCase();
                  return groupName.includes(query);
                })
                .map((group) => {
                  const section = tripSections.find((sec) => sec.groups.some((g) => g.id === group.id));
                  if (!section) return null;
                  const groupSummary = calculateExpenseGroupSummary(group, crew, user?.id);
                  return (
                    <Pressable
                      key={group.id}
                      onPress={() => {
                        // Open this group in the detail view.
                        setShowSearchModal(false);
                        openGroup(section.trip, group);
                      }}
                      style={styles.searchRow}
                    >
                      <Text style={styles.searchRowText}>{getExpenseGroupDisplayName(group.name, section.trip.name)}</Text>
                      <Text style={styles.searchRowSubtext}>{formatMoney(groupSummary.totalSpent)}</Text>
                    </Pressable>
                  );
                })}
            </ScrollView>
            <Pressable style={styles.modalSecondaryButton} onPress={() => setShowSearchModal(false)}>
              <Text style={styles.modalSecondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function GroupAvatar({ index }: { index: number }) {
  const icon = groupIcons[index % groupIcons.length] as keyof typeof Ionicons.glyphMap;
  const color = groupIconColors[index % groupIconColors.length];
  return (
    <View style={[styles.groupAvatar, { backgroundColor: color }]}>
      <Ionicons name={icon} size={22} color={palette.white} />
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function buildPreviewLines(summary: ReturnType<typeof calculateExpenseGroupSummary>, userId?: number | string | null) {
  const userKey = userId != null ? String(userId) : '';
  return summary.currentUserBalanceLines.slice(0, 3).map((line) => {
    if (line.toMemberId === userKey) {
      return `${line.fromMemberName} owes you ${formatMoney(line.amount)}`;
    }
    return `You owe ${line.toMemberName} ${formatMoney(line.amount)}`;
  });
}

function formatActivityMonth(dateValue: string) {
  const parsedDate = new Date(dateValue);
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  return safeDate.toLocaleDateString(undefined, { month: 'short' });
}

function formatActivityDay(dateValue: string) {
  const parsedDate = new Date(dateValue);
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  return String(safeDate.getDate()).padStart(2, '0');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.screen,
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupText: {
    color: palette.teal,
    fontSize: 18,
    fontWeight: '700',
  },
  overallHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  overallHeaderText: {
    flex: 1,
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
  },
  positiveText: {
    color: palette.teal,
  },
  negativeText: {
    color: palette.orange,
  },
  groupList: {
    gap: 8,
  },
  groupRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  groupAvatar: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  groupCenter: {
    flex: 1,
    gap: 4,
  },
  groupName: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  groupSubline: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  groupRight: {
    width: 106,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  groupBalanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  groupBalanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  emptyCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panel,
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  hero: {
    backgroundColor: palette.blueHero,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  heroActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: palette.white,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  heroMemberPill: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  heroMemberText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  detailBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  detailHeadline: {
    color: palette.text,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 30,
  },
  detailSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  metricPill: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  settleButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: palette.orange,
  },
  settleButtonDisabled: {
    opacity: 0.7,
  },
  settleButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '800',
  },
  activitySection: {
    marginTop: 26,
    gap: 18,
  },
  monthBlock: {
    gap: 10,
  },
  monthLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  activityRowLast: {
    borderBottomWidth: 0,
  },
  activityDateWrap: {
    width: 44,
    alignItems: 'flex-start',
  },
  activityDateMonth: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  activityDateDay: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  activitySubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  activityAmountWrap: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  floatingActionWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingAction: {
    position: 'absolute',
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: palette.teal,
  },
  floatingActionText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.modalOverlay,
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panelSoft,
    color: palette.text,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalSecondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalSecondaryButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalPrimaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palette.teal,
  },
  modalPrimaryButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // Additional styles for settle and search modals
  settleModalCard: {
    width: '88%',
    borderRadius: 16,
    backgroundColor: palette.panel,
    padding: 20,
    maxHeight: '70%',
  },
  settleRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  settleRowText: {
    fontSize: 15,
    color: palette.text,
  },
  searchModalCard: {
    width: '90%',
    borderRadius: 16,
    backgroundColor: palette.panel,
    padding: 20,
    maxHeight: '80%',
  },
  searchRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchRowText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  searchRowSubtext: {
    fontSize: 14,
    color: palette.textMuted,
  },
});
