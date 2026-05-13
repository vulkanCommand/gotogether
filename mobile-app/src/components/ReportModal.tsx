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

import { createReport, ReportContentType } from '../config/api';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

const REPORT_REASONS = [
  'Inappropriate content',
  'Harassment or abuse',
  'Spam or scam',
  'Safety concern',
  'Other',
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  contentId?: string;
  reportedUserId?: number | null;
  subjectLabel?: string;
};

export default function ReportModal({
  visible,
  onClose,
  contentType,
  contentId,
  reportedUserId,
  subjectLabel,
}: Props) {
  const [selectedReason, setSelectedReason] = useState<(typeof REPORT_REASONS)[number] | ''>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedReason('');
      setDetails('');
      setSubmitting(false);
    }
  }, [visible]);

  const title = useMemo(() => {
    if (subjectLabel?.trim()) {
      return `Report ${subjectLabel.trim()}`;
    }

    switch (contentType) {
      case 'trip':
        return 'Report trip';
      case 'event':
        return 'Report event';
      case 'expense':
        return 'Report expense';
      case 'photo':
        return 'Report photo';
      case 'user':
        return 'Report user';
      default:
        return 'Submit report';
    }
  }, [contentType, subjectLabel]);

  const handleClose = () => {
    if (submitting) {
      return;
    }

    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Choose a reason', 'Select a reason before sending your report.');
      return;
    }

    try {
      setSubmitting(true);

      await createReport({
        reported_user_id: reportedUserId ?? undefined,
        content_type: contentType,
        content_id: contentId,
        reason: selectedReason,
        details: details.trim() || undefined,
      });

      onClose();
      Alert.alert('Report submitted', 'Thanks. Your report was submitted.');
    } catch {
      Alert.alert('Report failed', 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardWrap}>
          <Pressable style={styles.card} onPress={() => undefined}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Let us know what happened. Reports do not change trip content automatically.</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.reasonList}>
              {REPORT_REASONS.map((reason) => {
                const selected = selectedReason === reason;

                return (
                  <Pressable
                    key={reason}
                    style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                    onPress={() => setSelectedReason(reason)}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{reason}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Add details (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />

            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={handleClose} disabled={submitting}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, (!selectedReason || submitting) && styles.primaryButtonDisabled]}
                onPress={() => void handleSubmit()}
                disabled={!selectedReason || submitting}
              >
                <Text style={styles.primaryButtonText}>{submitting ? 'Submitting...' : 'Submit report'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  keyboardWrap: {
    width: '100%',
    justifyContent: 'center',
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxHeight: '82%',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  reasonList: {
    gap: 10,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  reasonRow: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reasonRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  reasonText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  reasonTextSelected: {
    color: colors.accentStrong,
    fontWeight: '600',
  },
  input: {
    minHeight: 100,
    marginTop: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: spacing.md,
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
