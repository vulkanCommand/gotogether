import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

import ReportModal from '../components/ReportModal';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { CurrentTrip, ExpenseGroup, ExpenseItem, useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { footerScrollPadding } from '../theme/spacing';
import { CACHE_TTLS, cacheKeys, fetchWithCache, invalidateTripCaches, isCacheFresh, readCachedValue, writeCachedValue } from '../services/resourceCache';
import { createExpenseGroup, createTripExpense, deleteTripExpense, fetchExpenseGroups, fetchTripDetails, fetchTrips } from '../config/api';
import {
  calculateExpenseGroupSummary,
  calculateOverallExpenseSummary,
  formatMoney,
  getBalanceDisplay,
  getExpenseGroupDisplayName,
  getExpenseImpactAmount,
  getExpenseImpactLabel,
  groupExpensesByMonth,
  isSettlementExpense,
} from '../utils/expenseCalculations';
import { TEXT_SAFETY_ERROR_MESSAGE, validateUserText } from '../utils/textSafety';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Expenses'>,
  NativeStackScreenProps<RootStackParamList>
>;

type TripSection = {
  trip: CurrentTrip;
  groups: ExpenseGroup[];
};

const EXPENSE_SECTIONS_CACHE_KEY = 'expenses:sections';

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
  green: '#16A34A',
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

const parseCurrencyInput = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, '');
  const parts = normalized.split('.');
  const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
};

const groupIcons = ['document-text-outline', 'home-outline', 'airplane-outline', 'wallet-outline'];
const groupIconColors = ['#134E7A', '#145C43', '#A44B12', '#7A1748'];

const toTimestamp = (value?: string | null) => {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getGroupLastActivityAt = (group: ExpenseGroup, trip: CurrentTrip) => {
  const latestExpenseTimestamp = (group.expenses ?? []).reduce((latest, expense) => {
    return Math.max(latest, toTimestamp(expense.createdAt));
  }, 0);

  return latestExpenseTimestamp || toTimestamp(group.createdAt) || toTimestamp(trip.end_date) || toTimestamp(trip.start_date);
};

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
  const [settlementAmount, setSettlementAmount] = useState('');
  const settlementSubmittingRef = useRef(false);

  // Search modal state to allow filtering groups when tapping the search icon.
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportExpense, setReportExpense] = useState<ExpenseItem | null>(null);
  const hasLoadedRef = useRef(false);
  const lastFetchedRef = useRef(0);

  const applySections = useCallback((sections: TripSection[]) => {
    setTripSections(sections);

    const activeTripId = currentTrip?.id ?? sections[0]?.trip.id ?? null;
    const activeGroups = sections.find((section) => section.trip.id === activeTripId)?.groups ?? [];

    setExpenseGroups(activeGroups);
    setExpenses(activeGroups.flatMap((group) => group.expenses ?? []));
  }, [currentTrip?.id, setExpenseGroups, setExpenses]);

  const refreshGroups = useCallback(async (showSpinner = false, force = false) => {
    const cachedSections = await readCachedValue<TripSection[]>(EXPENSE_SECTIONS_CACHE_KEY);

    if (cachedSections && !hasLoadedRef.current) {
      applySections(cachedSections.value);
      hasLoadedRef.current = true;
      lastFetchedRef.current = cachedSections.updatedAt;
      setLoading(false);
    }

    try {
      if (showSpinner && !hasLoadedRef.current) {
        setLoading(true);
      }

      const tripsResponse = await fetchWithCache(
        cacheKeys.trips,
        CACHE_TTLS.trips,
        async () => {
          const tripData = await fetchTrips();
          return Array.isArray(tripData.trips) ? (tripData.trips as CurrentTrip[]) : [];
        },
        { force }
      );

      const trips = tripsResponse.data;
      const sections = await Promise.all(
        trips.map(async (trip) => {
          const groupData = await fetchWithCache(
            cacheKeys.expenseGroups(trip.id),
            CACHE_TTLS.expenseGroups,
            async () => {
              const response = await fetchExpenseGroups(trip.id);
              return (response.groups ?? []) as ExpenseGroup[];
            },
            { force }
          );

          return {
            trip: trip as CurrentTrip,
            groups: groupData.data,
          };
        })
      );

      applySections(sections);
      await writeCachedValue(EXPENSE_SECTIONS_CACHE_KEY, sections);
      hasLoadedRef.current = true;
      lastFetchedRef.current = Date.now();
    } catch (error) {
      console.log('Fetch expense groups failed', error);
      if (!hasLoadedRef.current) {
        setTripSections([]);
        setExpenseGroups([]);
        setExpenses([]);
      }
    } finally {
      setLoading(false);
    }
  }, [applySections, setExpenseGroups, setExpenses]);

  useEffect(() => {
    void refreshGroups(true);
  }, [refreshGroups]);

  useFocusEffect(
    useCallback(() => {
      const stale = Date.now() - lastFetchedRef.current > CACHE_TTLS.expenseGroups;
      void refreshGroups(false, !hasLoadedRef.current ? false : stale);
    }, [refreshGroups])
  );

  const allGroups = useMemo(() => tripSections.flatMap((section) => section.groups), [tripSections]);
  const sortedOverviewGroups = useMemo(
    () =>
      tripSections
        .flatMap((section, sectionIndex) =>
          section.groups.map((group, groupIndex) => ({
            group,
            trip: section.trip,
            lastActivityAt: getGroupLastActivityAt(group, section.trip),
            stableIndex: sectionIndex * 1000 + groupIndex,
          }))
        )
        .sort((left, right) => {
          if (left.lastActivityAt !== right.lastActivityAt) {
            return right.lastActivityAt - left.lastActivityAt;
          }

          const tripNameComparison = left.trip.name.localeCompare(right.trip.name);
          if (tripNameComparison !== 0) {
            return tripNameComparison;
          }

          const groupNameComparison = left.group.name.localeCompare(right.group.name);
          if (groupNameComparison !== 0) {
            return groupNameComparison;
          }

          return left.stableIndex - right.stableIndex;
        }),
    [tripSections]
  );
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
    if (!selectedGroup || !selectedSection) {
      Alert.alert('Choose a group first', 'Open an expense group before adding a new expense.');
      return;
    }

    navigation.navigate('AddExpense', { tripId: selectedSection.trip.id, groupId: selectedGroup.id });
  };

  const editExpense = (expense: ExpenseItem) => {
    if (!selectedGroup || !selectedSection) {
      return;
    }

    navigation.navigate('AddExpense', { tripId: selectedSection.trip.id, groupId: selectedGroup.id, expenseId: expense.id });
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
            await invalidateTripCaches(selectedSection.trip.id);
            await refreshGroups(false, true);
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

    const groupNameValidation = validateUserText(newGroupName, { required: true, maxLength: 80 });
    if (groupNameValidation.reason === 'required') {
      Alert.alert('Choose a trip first', 'Open a trip expense group first, then create another group inside that trip.');
      return;
    }
    if (!groupNameValidation.ok) {
      Alert.alert('Edit text', TEXT_SAFETY_ERROR_MESSAGE);
      return;
    }

    try {
      await createExpenseGroup(tripForGroup.id, { name: groupNameValidation.value });
      setNewGroupName('');
      setShowGroupModal(false);
      await invalidateTripCaches(tripForGroup.id);
      await refreshGroups(false, true);
    } catch (error: any) {
      Alert.alert('Group failed', error?.message || 'Could not create expense group');
    }
  };

  const closeSettleModal = () => {
    if (settling) {
      return;
    }

    setShowSettleModal(false);
    setSelectedSettleLine(null);
    setSettlementAmount('');
  };

  const handleSettleUp = () => {
    if (!selectedGroupSummary || selectedGroupSummary.currentUserBalanceLines.length === 0) {
      Alert.alert('Nothing to settle', 'You are already settled in this group.');
      return;
    }

    setSelectedSettleLine(null);
    setSettlementAmount('');
    setShowSettleModal(true);
  };

  const selectSettleLine = (line: BalanceLine) => {
    setSelectedSettleLine(line);
    setSettlementAmount(line.amount.toFixed(2));
  };

  const createSingleSettlement = async (line: BalanceLine, method: 'Cash' | 'Card') => {
    if (!selectedSection?.trip.id || !selectedGroup || settling || settlementSubmittingRef.current) {
      return;
    }

    const enteredAmount = parseCurrencyInput(settlementAmount);
    if (enteredAmount <= 0) {
      Alert.alert('Enter amount', 'Enter how much you want to settle.');
      return;
    }

    if (enteredAmount - line.amount > 0.01) {
      Alert.alert('Amount too high', `You can settle up to ${formatMoney(line.amount)} with this person.`);
      return;
    }

    try {
      settlementSubmittingRef.current = true;
      setSettling(true);
      const debtorId = Number(line.fromMemberId);
      const creditorId = Number(line.toMemberId);
      const debtorName = line.fromMemberName;
      const creditorName = line.toMemberName;
      const paymentAmount = Math.round((enteredAmount + Number.EPSILON) * 100) / 100;

      // Settlements must always flow from the debtor to the creditor so they
      // reduce the existing balance instead of creating a new debt in reverse.
      await createTripExpense(selectedSection.trip.id, {
        title: `Settlement to ${creditorName}`,
        amount: paymentAmount,
        paidByUserId: debtorId,
        expenseGroupId: selectedGroup.id,
        linkedEventId: '',
        splitMethod: `Settlement - ${method}`,
        notes: `Settled ${formatMoney(paymentAmount)} by ${method.toLowerCase()}`,
        splitPreview: [
          {
            memberId: String(creditorId),
            memberName: creditorName,
            amount: paymentAmount,
          },
        ],
      });

      await invalidateTripCaches(selectedSection.trip.id);
      await refreshGroups(false, true);
      const remaining = Math.max(0, Math.round((line.amount - paymentAmount + Number.EPSILON) * 100) / 100);
      closeSettleModal();
      Alert.alert(
        'Settlement recorded',
        remaining > 0.009
          ? `${formatMoney(paymentAmount)} settled. Remaining balance between ${debtorName} and ${creditorName}: ${formatMoney(remaining)}.`
          : `Balance between ${debtorName} and ${creditorName} cleared using ${method}.`
      );
    } catch (error: any) {
      Alert.alert('Settle up failed', error?.message || 'Could not settle this balance.');
    } finally {
      settlementSubmittingRef.current = false;
      setSettling(false);
    }
  };

  const renderOverview = () => {
    const overallDisplay = getBalanceDisplay(overallSummary.netBalance);

    return (
      <>
        <View style={styles.topRow}>
          <Pressable
            style={styles.circleButton}
            onPress={() => {
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
          <View style={styles.overallBalanceBlock}>
            <Text style={[styles.overallBalanceAmount, overallDisplay.isPositive ? styles.positiveText : styles.negativeText]}>
              {formatMoney(overallDisplay.amount)}
            </Text>
            <Text style={styles.overallBalanceLabel}>{overallDisplay.label}</Text>
          </View>
          <Pressable style={styles.circleButton} onPress={() => void refreshGroups()}>
            {loading ? <ActivityIndicator color={palette.text} /> : <Ionicons name="options-outline" size={22} color={palette.text} />}
          </Pressable>
        </View>

        <View style={styles.groupList}>
          {sortedOverviewGroups.map(({ group, trip }, index) => {
            const groupSummary = calculateExpenseGroupSummary(group, crew, user?.id);
            const previewLines = buildPreviewLines(groupSummary, user?.id);
            const groupDisplay = getBalanceDisplay(groupSummary.netBalance);

            return (
              <Pressable key={group.id} style={styles.groupRow} onPress={() => openGroup(trip, group)}>
                <GroupAvatar index={index} />
                <View style={styles.groupCenter}>
                  <Text style={styles.groupName}>{getExpenseGroupDisplayName(group.name, trip.name)}</Text>
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
                  <Text style={styles.groupBalanceLabel}>{groupDisplay.label}</Text>
                  <Text style={[styles.groupBalanceAmount, groupDisplay.isPositive ? styles.positiveText : styles.negativeText]}>
                    {formatMoney(groupDisplay.amount)}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {!loading && sortedOverviewGroups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No expense groups yet</Text>
              <Text style={styles.emptyText}>Create a group and start adding trip expenses.</Text>
            </View>
          ) : null}
        </View>
      </>
    );
  };

  const renderDetail = () => {
    if (!selectedGroup || !selectedSection || !selectedGroupSummary) {
      return null;
    }

    const balanceDisplay = getBalanceDisplay(selectedGroupSummary.netBalance);
    const memberCount = Math.max(selectedSection.trip.members_count ?? 0, selectedGroupSummary.memberTotals.length);
    const canDeleteExpenses = selectedSection.trip.created_by === user?.id;

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
            {balanceDisplay.isSettled ? 'You are settled up' : `${balanceDisplay.headline} `}
            {!balanceDisplay.isSettled ? (
              <Text style={balanceDisplay.isPositive ? styles.positiveText : styles.negativeText}>
                {formatMoney(balanceDisplay.amount)}
              </Text>
            ) : null}
          </Text>

          <View style={styles.detailSummaryRow}>
            <MetricPill label={balanceDisplay.label} value={formatMoney(balanceDisplay.amount)} />
            <MetricPill label="Open balances" value={`${selectedGroupSummary.currentUserBalanceLines.length}`} />
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
                  const impactAmount = getExpenseImpactAmount(expense, user?.id);
                  const tonePositive = impactAmount >= 0;
                  const displayAmount =
                    impactAmount > 0.009
                      ? `+${formatMoney(impactAmount)}`
                      : impactAmount < -0.009
                        ? `-${formatMoney(Math.abs(impactAmount))}`
                        : formatMoney(0);
                  return (
                    <Pressable
                      key={expense.id}
                      style={[styles.activityRow, index === monthGroup.expenses.length - 1 && styles.activityRowLast]}
                      onLongPress={() =>
                        Alert.alert(
                          expense.title,
                          'Choose an action',
                          [
                            { text: 'Edit', onPress: () => editExpense(expense) },
                            { text: 'Report', style: 'destructive', onPress: () => setReportExpense(expense) },
                            canDeleteExpenses
                              ? { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(expense) }
                              : null,
                            { text: 'Cancel', style: 'cancel' },
                          ].filter(Boolean) as Array<{
                            text: string;
                            style?: 'default' | 'cancel' | 'destructive';
                            onPress?: () => void;
                          }>
                        )
                      }
                    >
                      <View style={styles.activityDateWrap}>
                        <Text style={styles.activityDateMonth}>{formatActivityMonth(expense.createdAt)}</Text>
                        <Text style={styles.activityDateDay}>{formatActivityDay(expense.createdAt)}</Text>
                      </View>

                      <View style={styles.activityIconWrap}>
                        <Ionicons
                          name={isSettlementExpense(expense) ? 'swap-horizontal-outline' : 'cash-outline'}
                          size={19}
                          color={palette.teal}
                        />
                      </View>

                      <View style={styles.activityContent}>
                        <Text style={styles.activityTitle}>{expense.title}</Text>
                        <Text style={styles.activitySubtitle} numberOfLines={2}>
                          {impact || `${expense.paidBy} paid ${formatMoney(expense.amount)}`}
                        </Text>
                      </View>

                      <View style={styles.activityAmountWrap}>
                        <Text style={[styles.activityAmount, tonePositive ? styles.positiveText : styles.negativeText]}>
                          {displayAmount}
                        </Text>
                        <Text style={styles.activityTotalAmount}>{formatMoney(expense.amount)}</Text>
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
        contentContainerStyle={{ paddingBottom: footerScrollPadding + 28 }}
      >
        {selectedGroup ? renderDetail() : <View style={[styles.content, { paddingTop: Math.max(insets.top, 22) + 8 }]}>{renderOverview()}</View>}
      </ScrollView>

      {(!selectedGroup || selectedSection) && (
        <View pointerEvents="box-none" style={styles.floatingActionWrap}>
          <Pressable style={[styles.floatingAction, { bottom: Math.max(insets.bottom, 18) + 8 }]} onPress={openAddExpense}>
            <Ionicons name="receipt-outline" size={20} color={palette.white} />
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

      <Modal visible={showSettleModal} transparent animationType="fade" onRequestClose={closeSettleModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.settleKeyboardWrap}
            keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 0}
          >
            <View style={styles.settleModalCard}>
              <View style={styles.settleHeaderRow}>
                <Text style={styles.modalTitle}>Settle up</Text>
                <Pressable
                  onPress={closeSettleModal}
                  style={styles.settleCloseButton}
                  disabled={settling}
                >
                  <Ionicons name="close" size={18} color={palette.text} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                Choose one person, enter how much is being paid, then select cash or card.
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.settleListContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {selectedGroupSummary?.currentUserBalanceLines?.map((line) => {
                  const userKey = String(user?.id ?? '');
                  const userOwes = line.fromMemberId === userKey;
                  const personName = userOwes ? line.toMemberName : line.fromMemberName;
                  const descriptor = userOwes
                    ? `You owe ${formatMoney(line.amount)} to ${personName}`
                    : `${personName} owes you ${formatMoney(line.amount)}`;
                  const selected = selectedSettleLine === line;

                  return (
                    <Pressable
                      key={`${line.fromMemberId}-${line.toMemberId}`}
                      onPress={() => selectSettleLine(line)}
                      style={[styles.settleRow, selected && styles.settleRowSelected]}
                    >
                      <View style={styles.settleRowCopy}>
                        <Text style={styles.settleRowText}>{personName}</Text>
                        <Text style={styles.settleRowSubtext}>{descriptor}</Text>
                      </View>
                      <Text style={[styles.settleRowAmount, userOwes ? styles.negativeText : styles.positiveText]}>
                        {formatMoney(line.amount)}
                      </Text>
                    </Pressable>
                  );
                })}

                {(!selectedGroupSummary || selectedGroupSummary.currentUserBalanceLines.length === 0) ? (
                  <Text style={styles.emptyText}>No balances to settle.</Text>
                ) : null}

                {selectedSettleLine ? (() => {
                  const userKey = String(user?.id ?? '');
                  const userOwes = selectedSettleLine.fromMemberId === userKey;
                  const personName = userOwes ? selectedSettleLine.toMemberName : selectedSettleLine.fromMemberName;
                  const enteredAmount = parseCurrencyInput(settlementAmount);
                  const canSubmitSettlement =
                    enteredAmount > 0 &&
                    enteredAmount - selectedSettleLine.amount <= 0.01 &&
                    !settling &&
                    !settlementSubmittingRef.current;
                  const remainingAmount = Math.max(
                    0,
                    Math.round((selectedSettleLine.amount - enteredAmount + Number.EPSILON) * 100) / 100
                  );

                  return (
                    <View style={styles.settlePaymentCard}>
                      <Text style={styles.settlePaymentTitle}>Amount to settle with {personName}</Text>
                      <TextInput
                        value={settlementAmount}
                        onChangeText={setSettlementAmount}
                        placeholder="0.00"
                        placeholderTextColor={palette.textMuted}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        style={styles.modalInput}
                      />
                      <Text style={styles.settlePaymentMeta}>
                        {remainingAmount > 0.009
                          ? `Remaining after this payment: ${formatMoney(remainingAmount)}`
                          : 'This clears the balance with this person.'}
                      </Text>

                      <View style={styles.paymentMethodRow}>
                        <Pressable
                          style={[styles.modalPrimaryButton, !canSubmitSettlement && styles.settleButtonDisabled]}
                          onPress={() => void createSingleSettlement(selectedSettleLine, 'Cash')}
                          disabled={!canSubmitSettlement}
                        >
                          <Text style={styles.modalPrimaryButtonText}>Cash</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modalPrimaryButton, !canSubmitSettlement && styles.settleButtonDisabled]}
                          onPress={() => void createSingleSettlement(selectedSettleLine, 'Card')}
                          disabled={!canSubmitSettlement}
                        >
                          <Text style={styles.modalPrimaryButtonText}>Card</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })() : null}

                <Pressable style={styles.modalSecondaryButton} onPress={closeSettleModal} disabled={settling}>
                  <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
              {sortedOverviewGroups
                .filter(({ group, trip }) => {
                  const query = searchQuery.trim().toLowerCase();
                  if (!query) return true;
                  const groupName = getExpenseGroupDisplayName(group.name, trip.name).toLowerCase();
                  return groupName.includes(query);
                })
                .map(({ group, trip }) => {
                  const groupSummary = calculateExpenseGroupSummary(group, crew, user?.id);
                  const groupDisplay = getBalanceDisplay(groupSummary.netBalance);
                  return (
                    <Pressable
                      key={group.id}
                      onPress={() => {
                        // Open this group in the detail view.
                        setShowSearchModal(false);
                        openGroup(trip, group);
                      }}
                      style={styles.searchRow}
                    >
                      <Text style={styles.searchRowText}>{getExpenseGroupDisplayName(group.name, trip.name)}</Text>
                      <Text style={[styles.searchRowSubtext, groupDisplay.isPositive ? styles.positiveText : styles.negativeText]}>{groupDisplay.label} {formatMoney(groupDisplay.amount)}</Text>
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

      <ReportModal
        visible={Boolean(reportExpense)}
        onClose={() => setReportExpense(null)}
        contentType="expense"
        contentId={reportExpense?.id}
        subjectLabel={reportExpense?.title || 'expense'}
      />
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
    fontSize: 16,
    fontWeight: '600',
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
  overallBalanceBlock: {
    flex: 1,
  },
  overallBalanceAmount: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  overallBalanceLabel: {
    marginTop: 3,
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  positiveText: {
    color: palette.green,
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
    paddingVertical: 14,
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
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
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
    fontWeight: '600',
  },
  detailBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  detailHeadline: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 28,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
  activityTotalAmount: {
    marginTop: 3,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
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
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: palette.teal,
  },
  floatingActionText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },

  // Additional styles for settle and search modals
  settleModalCard: {
    width: '90%',
    borderRadius: 22,
    backgroundColor: palette.panel,
    padding: 20,
    maxHeight: '88%',
    gap: 12,
  },
  settleKeyboardWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settleCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.panelSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  settleListContent: {
    gap: 8,
    paddingVertical: 4,
    paddingBottom: 8,
  },
  settleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panelSoft,
  },
  settleRowSelected: {
    borderColor: palette.teal,
    backgroundColor: palette.tealSoft,
  },
  settleRowCopy: {
    flex: 1,
    gap: 4,
  },
  settleRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  settleRowSubtext: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  settleRowAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  settlePaymentCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panelSoft,
    padding: 14,
    gap: 10,
  },
  settlePaymentTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  settlePaymentMeta: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 10,
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
    fontWeight: '600',
    color: palette.text,
  },
  searchRowSubtext: {
    fontSize: 14,
    color: palette.textMuted,
  },
});
