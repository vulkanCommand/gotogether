import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
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

import AppFooter from '../components/AppFooter';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { ExpenseSplit, useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { createTripExpense, updateTripExpense } from '../config/api';
import { buildEqualSplitPreview, formatMoney, getExpenseGroupDisplayName } from '../utils/expenseCalculations';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;
type SplitMode = 'Equal split' | 'Custom split';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

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
  const perPersonLabel = splitPreview.length > 0 ? formatMoney(amountValue / splitPreview.length) : '$0.00';
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

  const handleSave = async () => {
    if (!currentTrip?.id) {
      Alert.alert('No trip selected', 'Open a trip before adding an expense.');
      return;
    }
    if (!canSave) {
      Alert.alert('Expense incomplete', 'Add description, amount, group, and a valid split before saving.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        amount: amountValue,
        paidByUserId,
        expenseGroupId,
        linkedEventId,
        splitMethod,
        notes: notes.trim(),
        splitPreview,
      };

      const response = editingExpenseId
        ? await updateTripExpense(currentTrip.id, editingExpenseId, payload)
        : await createTripExpense(currentTrip.id, payload);

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

      navigation.navigate('MainTabs', { screen: 'Expenses' });
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 12 }]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerAction}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{editingExpenseId ? 'Edit expense' : 'Add expense'}</Text>
          <Pressable onPress={handleSave} disabled={!canSave || saving} style={styles.headerSaveWrap}>
            <Text style={[styles.headerSave, (!canSave || saving) && styles.headerSaveDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.contextCard}>
          <Text style={styles.contextLabel}>With you and</Text>
          <View style={styles.contextBadge}>
            <Ionicons name="wallet-outline" size={16} color={colors.accentStrong} />
            <Text style={styles.contextBadgeText}>{selectedGroupLabel || currentTrip?.name || 'Trip expenses'}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <FieldLabel label="Description" />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Dinner, cab, tickets..."
            placeholderTextColor={colors.textMuted}
            style={styles.textInput}
          />

          <FieldLabel label="Amount" />
          <View style={styles.amountRow}>
            <View style={styles.amountIcon}>
              <Text style={styles.amountCurrency}>$</Text>
            </View>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.amountInput}
            />
          </View>

          <View style={styles.metaGrid}>
            <InfoButton
              label="Paid by"
              value={memberOptions.find((member) => Number(member.id) === paidByUserId)?.name || 'Select'}
              onPress={() =>
                Alert.alert(
                  'Paid by',
                  'Choose who paid the full amount.',
                  memberOptions.map((member) => ({
                    text: member.name,
                    onPress: () => setPaidByUserId(Number(member.id)),
                  })).concat([{ text: 'Cancel', style: 'cancel' } as any])
                )
              }
            />
            <InfoButton
              label="Split"
              value={splitMethod === 'Equal split' ? `Equal - ${splitPreview.length}` : `Custom - ${splitPreview.length}`}
              onPress={() => setShowSplitModal(true)}
            />
            <InfoButton
              label="Group"
              value={selectedGroup ? getExpenseGroupDisplayName(selectedGroup.name, currentTrip?.name) : 'Select'}
              onPress={() =>
                Alert.alert(
                  'Expense group',
                  'Choose where this expense belongs.',
                  expenseGroups.map((group) => ({
                    text: getExpenseGroupDisplayName(group.name, currentTrip?.name),
                    onPress: () => setExpenseGroupId(group.id),
                  })).concat([{ text: 'Cancel', style: 'cancel' } as any])
                )
              }
            />
          </View>

          {eventOptions.length > 0 ? (
            <>
              <FieldLabel label="Linked itinerary event" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkedEventRow}>
                <MiniChip label="None" selected={!linkedEventId} onPress={() => setLinkedEventId('')} />
                {eventOptions.map((event) => (
                  <MiniChip
                    key={event.id}
                    label={`${event.meta} - ${event.label}`}
                    selected={linkedEventId === event.id}
                    onPress={() => setLinkedEventId(event.id)}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}

          <FieldLabel label="Notes (optional)" />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add context if it helps the group later"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.notesInput}
          />
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <View>
              <Text style={styles.previewLabel}>Split preview</Text>
              <Text style={styles.previewTitle}>
                {splitMethod === 'Equal split' ? `${perPersonLabel} each` : `${formatMoney(customTotal)} assigned`}
              </Text>
            </View>
            <Text style={styles.previewMeta}>{splitPreview.length} people</Text>
          </View>

          {splitPreview.map((split) => (
            <View key={split.memberId} style={styles.previewRow}>
              <Text style={styles.previewName}>{split.memberName}</Text>
              <Text style={styles.previewAmount}>{formatMoney(split.amount)}</Text>
            </View>
          ))}

          {splitMethod === 'Custom split' && !customValid ? (
            <Text style={styles.previewWarning}>
              Custom split must total {formatMoney(amountValue)} before you can save.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={showSplitModal} animationType="slide" transparent onRequestClose={() => setShowSplitModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowSplitModal(false)}>
                <Text style={styles.modalAction}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Split options</Text>
              <Pressable onPress={() => setShowSplitModal(false)}>
                <Text style={styles.modalAction}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.modeToggle}>
              {(['Equal split', 'Custom split'] as SplitMode[]).map((mode) => {
                const selected = splitMethod === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setSplitMethod(mode)}
                    style={[styles.modeButton, selected && styles.modeButtonSelected]}
                  >
                    <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>
                      {mode === 'Equal split' ? 'Equal' : 'Custom'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.modalSubtitle}>
              {splitMethod === 'Equal split'
                ? 'Choose who shares this expense equally.'
                : 'Choose who is included and enter each share.'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
              {memberOptions.map((member) => {
                const selected = selectedParticipantIds.includes(member.id);
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <Pressable style={styles.memberToggleArea} onPress={() => toggleParticipant(member.id)}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>{member.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.memberName}>{member.name}</Text>
                    </Pressable>

                    {splitMethod === 'Custom split' ? (
                      <View style={styles.customEntryRow}>
                        <Pressable
                          onPress={() => toggleParticipant(member.id)}
                          style={[styles.checkCircle, selected && styles.checkCircleSelected]}
                        >
                          {selected ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
                        </Pressable>
                        <TextInput
                          value={customAmounts[member.id] ?? ''}
                          onChangeText={(value) => {
                            setSelectedParticipantIds((current) =>
                              current.includes(member.id) ? current : [...current, member.id]
                            );
                            setCustomAmounts((current) => ({ ...current, [member.id]: value }));
                          }}
                          placeholder="0.00"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          style={[styles.customInput, !selected && styles.customInputMuted]}
                        />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => toggleParticipant(member.id)}
                        style={[styles.checkCircle, selected && styles.checkCircleSelected]}
                      >
                        {selected ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <View>
                <Text style={styles.modalFooterValue}>
                  {splitMethod === 'Equal split' ? `${perPersonLabel} each` : formatMoney(customTotal)}
                </Text>
                <Text style={styles.modalFooterMeta}>({splitPreview.length} people)</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <AppFooter />
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function InfoButton({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[styles.infoButton, !onPress && styles.infoButtonStatic]}>
      <Text style={styles.infoButtonLabel}>{label}</Text>
      <Text style={styles.infoButtonValue} numberOfLines={1}>
        {value}
      </Text>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

function MiniChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.miniChip, selected && styles.miniChipSelected]}>
      <Text style={[styles.miniChipText, selected && styles.miniChipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 118,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSaveWrap: {
    minWidth: 64,
    alignItems: 'flex-end',
  },
  headerSave: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSaveDisabled: {
    color: colors.textMuted,
  },
  contextCard: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  contextLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  contextBadgeText: {
    color: colors.accentStrong,
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  textInput: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  amountIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountCurrency: {
    color: colors.accentStrong,
    fontSize: 28,
    fontWeight: '800',
  },
  amountInput: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    paddingHorizontal: 16,
  },
  metaGrid: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  infoButton: {
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoButtonStatic: {
    opacity: 0.95,
  },
  infoButtonLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    width: 56,
  },
  infoButtonValue: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  linkedEventRow: {
    gap: 8,
    paddingBottom: 4,
  },
  miniChip: {
    maxWidth: 240,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
  },
  miniChipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  miniChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  miniChipTextSelected: {
    color: colors.accentStrong,
  },
  notesInput: {
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  previewLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewTitle: {
    marginTop: 6,
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  previewMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  previewAmount: {
    color: colors.accentStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  previewWarning: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.24)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalAction: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  modeButtonSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  modeButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modeButtonTextSelected: {
    color: colors.accentStrong,
  },
  modalSubtitle: {
    marginTop: 14,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  modalList: {
    paddingTop: 18,
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  memberToggleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: colors.accentStrong,
    fontSize: 15,
    fontWeight: '800',
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  customEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customInput: {
    minWidth: 88,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    textAlign: 'right',
  },
  customInputMuted: {
    opacity: 0.72,
  },
  modalFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooterValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  modalFooterMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
});
