import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GTCard from '../components/GTCard';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ExpenseSplit, useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { createTripExpense, updateTripExpense } from '../config/api';
import { invalidateTripCaches } from '../services/resourceCache';
import { buildEqualSplitPreview, formatMoney, getExpenseGroupDisplayName } from '../utils/expenseCalculations';
import { colors } from '../theme/colors';
import { shadows, spacing, typography } from '../theme/spacing';
import { TEXT_SAFETY_ERROR_MESSAGE, validateUserText } from '../utils/textSafety';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;
type SplitMode = 'Equal split' | 'Custom split';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const palette = {
  screen: colors.background,
  panel: colors.surface,
  panelSoft: colors.surfaceMuted,
  cardBorder: colors.border,
  heroText: colors.textPrimary,
  text: colors.textPrimary,
  textMuted: colors.textSecondary,
  line: colors.border,
  teal: colors.accent,
  tealSoft: colors.accentSoft,
  orange: colors.warning,
  red: colors.danger,
  white: colors.white,
  modalOverlay: colors.overlay,
};

export default function AddExpenseScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const crew = useTripStore((state) => state.crew);
  const expenses = useTripStore((state) => state.expenses);
  const expenseGroups = useTripStore((state) => state.expenseGroups);
  const itineraryDays = useTripStore((state) => state.itineraryDays);
  const addExpense = useTripStore((state) => state.addExpense);
  const updateExpense = useTripStore((state) => state.updateExpense);

  const crewList = crew.length > 0 ? crew : [];
  const defaultGroupId = route.params?.groupId ?? expenseGroups[0]?.id ?? 0;
  const editingExpenseId = route.params?.expenseId;
  const editingExpense = expenses.find((expense) => expense.id === editingExpenseId);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidByUserId, setPaidByUserId] = useState(Number(user?.id || crewList[0]?.id || 0));
  const [expenseGroupId, setExpenseGroupId] = useState(defaultGroupId);
  const [linkedEventId, setLinkedEventId] = useState(route.params?.eventId ?? '');
  const [splitMethod, setSplitMethod] = useState<SplitMode>('Equal split');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(crewList.map((member) => member.id));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  // show group picker modal for selecting an expense group from all available groups
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);

  useEffect(() => {
    if (crewList.length === 0) {
      return;
    }

    setSelectedParticipantIds((current) => (current.length > 0 ? current : crewList.map((member) => member.id)));
    if (!paidByUserId) {
      setPaidByUserId(Number(user?.id || crewList[0]?.id || 0));
    }
  }, [crewList, paidByUserId, user?.id]);

  useEffect(() => {
    if (!editingExpense) {
      return;
    }

    setTitle(editingExpense.title);
    setAmount(String(editingExpense.amount));
    setPaidByUserId(editingExpense.paidByUserId ?? Number(user?.id || crewList[0]?.id || 0));
    setExpenseGroupId(editingExpense.expenseGroupId ?? defaultGroupId);
    setLinkedEventId(editingExpense.linkedEventId ?? '');
    setSplitMethod(editingExpense.splitMethod.toLowerCase().includes('custom') ? 'Custom split' : 'Equal split');
    setNotes(editingExpense.notes ?? '');
    setSelectedParticipantIds(editingExpense.splitPreview.map((split) => split.memberId));
    setCustomAmounts(
      editingExpense.splitPreview.reduce<Record<string, string>>((accumulator, split) => {
        accumulator[split.memberId] = split.amount.toFixed(2);
        return accumulator;
      }, {})
    );
  }, [crewList, defaultGroupId, editingExpense, user?.id]);

  const selectedGroup = expenseGroups.find((group) => group.id === expenseGroupId) ?? expenseGroups[0] ?? null;
  const selectedGroupLabel = getExpenseGroupDisplayName(selectedGroup?.name || 'Trip expenses', currentTrip?.name);
  const amountValue = roundCurrency(Number(amount || 0));

  const memberOptions = useMemo(
    () =>
      crewList.map((member) => ({
        id: member.id,
        name: member.name,
      })),
    [crewList]
  );

  const eventOptions = useMemo(
    () =>
      itineraryDays.flatMap((day) =>
        day.events.map((event) => ({
          id: event.id,
          label: event.title,
          meta: day.title,
        }))
      ),
    [itineraryDays]
  );

  const splitPreview = useMemo<ExpenseSplit[]>(() => {
    const selectedMembers = memberOptions.filter((member) => selectedParticipantIds.includes(member.id));
    if (selectedMembers.length === 0) {
      return [];
    }

    if (splitMethod === 'Equal split') {
      return buildEqualSplitPreview(memberOptions, selectedParticipantIds, amountValue);
    }

    return selectedMembers.map((member) => ({
      memberId: member.id,
      memberName: member.name,
      amount: roundCurrency(Number(customAmounts[member.id] || 0)),
    }));
  }, [amountValue, customAmounts, memberOptions, selectedParticipantIds, splitMethod]);

  const customTotal = useMemo(
    () => roundCurrency(splitPreview.reduce((sum, split) => sum + split.amount, 0)),
    [splitPreview]
  );

  const customValid = splitMethod === 'Equal split' || Math.abs(customTotal - amountValue) <= 0.01;
  const canSave = title.trim().length > 0 && amountValue > 0 && splitPreview.length > 0 && customValid && expenseGroupId > 0;
  const paidByName = memberOptions.find((member) => Number(member.id) === paidByUserId)?.name || 'you';
  const paidByLabel = String(user?.id) === String(paidByUserId) ? 'you' : paidByName;
  const splitLabel = splitMethod === 'Equal split' ? 'equally' : 'custom';
  const perPersonLabel = splitPreview.length > 0 ? formatMoney(amountValue / splitPreview.length) : '$0.00';
  const payerSharesThisExpense = splitPreview.some((split) => Number(split.memberId) === paidByUserId);
  const splitExplanation =
    amountValue > 0 && splitPreview.length > 0
      ? `${paidByName} paid ${formatMoney(amountValue)}. ${splitPreview.length} ${splitPreview.length === 1 ? 'person is' : 'people are'} sharing this expense${payerSharesThisExpense ? '' : ', but the payer is not included in the share'}.`
      : 'Enter the amount and choose who should share this expense.';

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipantIds((current) => {
      if (current.includes(memberId)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((id) => id !== memberId);
      }
      return [...current, memberId];
    });
  };

  /**
   * Open a modal to choose which expense group this expense belongs to.
   * Previously this used a simple Alert which truncated long lists and
   * provided no scrolling. Using our own modal makes the list scrollable
   * and more user friendly on mobile devices.
   */
  const openGroupPicker = () => {
    setShowGroupPicker(true);
  };

  const handleSave = async () => {
    // Determine the tripId based on the selected group.  In earlier versions the
    // AddExpense screen always used the currently active trip.  If the user
    // chooses a group from a different trip the group has a tripId field.  We
    // fall back to currentTrip.id for backwards compatibility.
    const selectedGroupObj = expenseGroups.find((g) => g.id === expenseGroupId);
    const tripIdForExpense = route.params?.tripId ?? selectedGroupObj?.tripId ?? currentTrip?.id;
    if (!tripIdForExpense) {
      Alert.alert('No trip selected', 'Open a trip before adding an expense.');
      return;
    }

    if (!canSave) {
      Alert.alert('Expense incomplete', 'Add description, amount, group, and a valid split before saving.');
      return;
    }

    const titleValidation = validateUserText(title, { required: true, maxLength: 120 });
    const notesValidation = validateUserText(notes, { maxLength: 500 });
    if (titleValidation.reason === 'required') {
      Alert.alert('Expense incomplete', 'Add description, amount, group, and a valid split before saving.');
      return;
    }
    if (!titleValidation.ok || !notesValidation.ok) {
      Alert.alert('Edit text', TEXT_SAFETY_ERROR_MESSAGE);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: titleValidation.value,
        amount: amountValue,
        paidByUserId,
        expenseGroupId,
        linkedEventId,
        splitMethod,
        notes: notesValidation.value,
        splitPreview,
      };

      const response = editingExpenseId
        ? await updateTripExpense(tripIdForExpense, editingExpenseId, payload)
        : await createTripExpense(tripIdForExpense, payload);

      const savedExpense = {
        id: response.expense.id,
        title: response.expense.title ?? payload.title,
        amount: response.expense.amount ?? payload.amount,
        paidBy: response.expense.paidBy ?? memberOptions.find((member) => Number(member.id) === paidByUserId)?.name ?? 'Trip member',
        paidByUserId: response.expense.paidByUserId ?? paidByUserId,
        expenseGroupId: response.expense.expenseGroupId ?? expenseGroupId,
        linkedEventId: response.expense.linkedEventId ?? linkedEventId,
        linkedEventTitle: response.expense.linkedEventTitle,
        linkedDayTitle: response.expense.linkedDayTitle,
        splitMethod: response.expense.splitMethod ?? splitMethod,
        notes: response.expense.notes ?? payload.notes,
        createdAt: response.expense.createdAt || new Date().toISOString(),
        splitPreview: Array.isArray(response.expense.splitPreview) ? response.expense.splitPreview : splitPreview,
      };

      if (editingExpenseId) {
        updateExpense(editingExpenseId, savedExpense);
      } else {
        addExpense(savedExpense);
      }

      await invalidateTripCaches(tripIdForExpense);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'Expenses' } }],
      });
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        // Use height behavior on Android to ensure the view resizes when the keyboard appears.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close add expense" onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={22} color={palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{editingExpenseId ? 'Edit an expense' : 'Add an expense'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Save expense" onPress={handleSave} disabled={!canSave || saving} hitSlop={8}>
            <Text style={[styles.headerSaveText, (!canSave || saving) && styles.headerSaveTextDisabled]}>
              {saving ? 'Saving' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 28 }]}
        >
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Expense group</Text>
            <Pressable style={styles.groupPill} onPress={openGroupPicker}>
              <Ionicons name="people-outline" size={15} color={palette.text} />
              <Text style={styles.groupPillText} numberOfLines={1}>
                {selectedGroupLabel || currentTrip?.name || 'Trip expenses'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={palette.textMuted} />
            </Pressable>
          </View>

          <GTCard style={styles.formCard}>
            <View style={styles.editorRow}>
              <View style={styles.leadingIconBox}>
                <Ionicons name="receipt-outline" size={22} color={palette.teal} />
              </View>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Enter a description"
                placeholderTextColor={palette.textMuted}
                style={styles.editorInput}
              />
            </View>

            <View style={styles.editorRow}>
              <View style={styles.leadingIconBox}>
                <Text style={styles.currencySymbol}>$</Text>
              </View>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={palette.textMuted}
                keyboardType="numeric"
                style={styles.amountInput}
              />
            </View>

            <View style={styles.inlineActionRow}>
              <Text style={styles.inlineActionText}>Paid by</Text>
              <Pressable style={styles.inlineChip} onPress={() => setShowPayerModal(true)}>
                <Text style={styles.inlineChipText}>{paidByLabel}</Text>
              </Pressable>
              <Text style={styles.inlineActionText}>and split</Text>
              <Pressable style={styles.inlineChip} onPress={() => setShowSplitModal(true)}>
                <Text style={styles.inlineChipText}>{splitLabel}</Text>
              </Pressable>
            </View>
          </GTCard>

          <GTCard style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Split summary</Text>
              <Text style={styles.summaryMeta}>{splitPreview.length} people</Text>
            </View>

            <Text style={styles.summaryExplanation}>{splitExplanation}</Text>

            {splitPreview.length === 0 ? (
              <Text style={styles.summaryEmpty}>Choose people who are part of this expense.</Text>
            ) : (
              splitPreview.map((split) => (
                <View key={split.memberId} style={styles.summaryRow}>
                  <Text style={styles.summaryName}>{split.memberName}</Text>
                  <Text style={styles.summaryAmount}>{formatMoney(split.amount)}</Text>
                </View>
              ))
            )}

            {splitMethod === 'Custom split' && !customValid ? (
              <Text style={styles.summaryWarning}>Custom split must total {formatMoney(amountValue)}.</Text>
            ) : null}
          </GTCard>

          {eventOptions.length > 0 ? (
            <GTCard style={styles.optionalCard}>
              <Text style={styles.optionalTitle}>Link to itinerary</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <MemberChip label="None" selected={!linkedEventId} onPress={() => setLinkedEventId('')} compact />
                {eventOptions.map((event) => (
                  <MemberChip
                    key={event.id}
                    label={`${event.meta} - ${event.label}`}
                    selected={linkedEventId === event.id}
                    onPress={() => setLinkedEventId(event.id)}
                    compact
                  />
                ))}
              </ScrollView>
            </GTCard>
          ) : null}

          <GTCard style={styles.optionalCard}>
            <Text style={styles.optionalTitle}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note if the group needs context"
              placeholderTextColor={palette.textMuted}
              multiline
              style={styles.notesInput}
            />
          </GTCard>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPayerModal} transparent animationType="slide" onRequestClose={() => setShowPayerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowPayerModal(false)}>
                <Text style={styles.modalAction}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Paid by</Text>
              <Pressable onPress={() => setShowPayerModal(false)}>
                <Text style={styles.modalAction}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.modalLead}>Select who paid the full amount.</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
              {memberOptions.map((member) => {
                const selected = Number(member.id) === paidByUserId;
                return (
                  <Pressable
                    key={member.id}
                    style={styles.memberRow}
                    onPress={() => {
                      setPaidByUserId(Number(member.id));
                      setShowPayerModal(false);
                    }}
                  >
                    <View style={styles.memberLeft}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
                      </View>
                      <Text style={styles.memberName}>{member.name}</Text>
                    </View>
                    <SelectionCheck selected={selected} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSplitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSplitModal(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Wrap the split modal in a KeyboardAvoidingView so that custom split inputs are not hidden by the soft keyboard. */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            style={styles.modalCard}
          >
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowSplitModal(false)}>
                <Text style={styles.modalAction}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Split options</Text>
              <Pressable onPress={() => setShowSplitModal(false)}>
                <Text style={styles.modalAction}>Done</Text>
              </Pressable>
            </View>

            <Text style={styles.modalHeading}>{splitMethod === 'Equal split' ? 'Split equally' : 'Custom split'}</Text>
            <Text style={styles.modalLead}>
              {splitMethod === 'Equal split'
                ? 'Select which people owe an equal share.'
                : 'Select people and enter each share so the total matches the expense amount.'}
            </Text>

            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setSplitMethod('Equal split')}
                style={[styles.modePill, splitMethod === 'Equal split' && styles.modePillSelected]}
              >
                <Text style={[styles.modePillText, splitMethod === 'Equal split' && styles.modePillTextSelected]}>=</Text>
              </Pressable>
              <Pressable
                onPress={() => setSplitMethod('Custom split')}
                style={[styles.modePill, splitMethod === 'Custom split' && styles.modePillSelected]}
              >
                <Text style={[styles.modePillText, splitMethod === 'Custom split' && styles.modePillTextSelected]}>1.23</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalList}
              keyboardShouldPersistTaps="handled"
            >
              {memberOptions.map((member) => {
                const selected = selectedParticipantIds.includes(member.id);
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <Pressable style={styles.memberLeft} onPress={() => toggleParticipant(member.id)}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
                      </View>
                      <Text style={styles.memberName}>{member.name}</Text>
                    </Pressable>

                    {splitMethod === 'Custom split' ? (
                      <View style={styles.customSplitRow}>
                        <TextInput
                          value={customAmounts[member.id] ?? ''}
                          onChangeText={(value) => {
                            setSelectedParticipantIds((current) =>
                              current.includes(member.id) ? current : [...current, member.id]
                            );
                            setCustomAmounts((current) => ({ ...current, [member.id]: value }));
                          }}
                          placeholder="0.00"
                          placeholderTextColor={palette.textMuted}
                          keyboardType="numeric"
                          style={[styles.customAmountInput, !selected && styles.customAmountInputMuted]}
                        />
                        <Pressable onPress={() => toggleParticipant(member.id)}>
                          <SelectionCheck selected={selected} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => toggleParticipant(member.id)}>
                        <SelectionCheck selected={selected} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <View>
                <Text style={styles.modalFooterValue}>
                  {splitMethod === 'Equal split' ? `${perPersonLabel}/person` : formatMoney(customTotal)}
                </Text>
                <Text style={styles.modalFooterMeta}>
                  {selectedParticipantIds.length === memberOptions.length ? 'All' : `${selectedParticipantIds.length} selected`}
                </Text>
              </View>
              {splitMethod === 'Custom split' && !customValid ? (
                <Text style={styles.modalFooterWarning}>Needs {formatMoney(amountValue)}</Text>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Expense group picker modal */}
      <Modal
        visible={showGroupPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGroupPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowGroupPicker(false)}>
                <Text style={styles.modalAction}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Select group</Text>
              <Pressable onPress={() => setShowGroupPicker(false)}>
                <Text style={styles.modalAction}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.modalLead}>Choose where this expense belongs.</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
              {expenseGroups.map((group) => {
                const selected = group.id === expenseGroupId;
                return (
                  <Pressable
                    key={group.id}
                    style={styles.memberRow}
                    onPress={() => {
                      setExpenseGroupId(group.id);
                      setShowGroupPicker(false);
                    }}
                  >
                    <View style={styles.memberLeft}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{getInitials(getExpenseGroupDisplayName(group.name, currentTrip?.name).slice(0, 2))}</Text>
                      </View>
                      <Text style={styles.memberName}>{getExpenseGroupDisplayName(group.name, currentTrip?.name)}</Text>
                    </View>
                    <SelectionCheck selected={selected} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MemberChip({
  label,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.memberChip, compact && styles.memberChipCompact, selected && styles.memberChipSelected]}>
      <Text style={[styles.memberChipText, selected && styles.memberChipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SelectionCheck({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
      {selected ? <Ionicons name="checkmark" size={14} color={palette.white} /> : null}
    </View>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerActionText: {
    minWidth: 44,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: palette.heroText,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSaveText: {
    color: palette.teal,
    fontSize: 17,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'right',
  },
  headerSaveTextDisabled: {
    color: palette.textMuted,
  },
  content: {
    paddingHorizontal: 20,
    gap: spacing.md,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contextLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  groupPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.panel,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  groupPillText: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  formCard: {
    gap: 16,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  leadingIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.tealSoft,
  },
  currencySymbol: {
    color: palette.teal,
    fontSize: 28,
    fontWeight: '600',
  },
  editorInput: {
    flex: 1,
    minHeight: 52,
    borderBottomWidth: 2,
    borderBottomColor: palette.teal,
    color: palette.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  amountInput: {
    flex: 1,
    minHeight: 52,
    borderBottomWidth: 2,
    borderBottomColor: palette.line,
    color: palette.text,
    fontSize: 26,
    fontWeight: '600',
    paddingVertical: 0,
  },
  inlineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
  },
  inlineActionText: {
    color: palette.text,
    fontSize: 15,
  },
  inlineChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inlineChipText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  summaryCard: {
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  summaryMeta: {
    color: palette.textMuted,
    fontSize: 13,
  },
  summaryEmpty: {
    color: palette.textMuted,
    fontSize: 14,
  },
  summaryExplanation: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  summaryName: {
    color: palette.text,
    fontSize: 15,
  },
  summaryAmount: {
    color: palette.teal,
    fontSize: 15,
    fontWeight: '600',
  },
  summaryWarning: {
    color: palette.red,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  optionalCard: {
    gap: 12,
  },
  optionalTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  chipRow: {
    gap: 10,
  },
  memberChip: {
    maxWidth: 220,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.panelSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  memberChipCompact: {
    paddingVertical: 9,
  },
  memberChipSelected: {
    borderColor: palette.teal,
    backgroundColor: palette.tealSoft,
  },
  memberChipText: {
    color: palette.text,
    fontSize: 13,
  },
  memberChipTextSelected: {
    color: palette.teal,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 90,
    borderRadius: 14,
    backgroundColor: palette.panelSoft,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    color: palette.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.modalOverlay,
  },
  modalCard: {
    maxHeight: '84%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: palette.screen,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    ...shadows.floating,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalAction: {
    color: palette.teal,
    fontSize: 18,
    fontWeight: '600',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalHeading: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 18,
  },
  modalLead: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  modePill: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.panelSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillSelected: {
    backgroundColor: palette.tealSoft,
    borderColor: palette.teal,
  },
  modePillText: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '600',
  },
  modePillTextSelected: {
    color: palette.teal,
  },
  modalList: {
    paddingTop: 18,
    gap: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  memberLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.panelSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  avatarText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  memberName: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: palette.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: palette.teal,
  },
  customSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customAmountInput: {
    width: 96,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.panelSoft,
    color: palette.text,
    textAlign: 'right',
    paddingHorizontal: 12,
    fontSize: 15,
  },
  customAmountInputMuted: {
    opacity: 0.65,
  },
  modalFooter: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooterValue: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '600',
  },
  modalFooterMeta: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  modalFooterWarning: {
    color: palette.orange,
    fontSize: 13,
    fontWeight: '600',
  },
});
