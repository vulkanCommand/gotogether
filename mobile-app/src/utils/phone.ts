const NON_DIGIT_PATTERN = /\D+/g;

export function normalizePhoneForComparison(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(NON_DIGIT_PATTERN, '');
  if (digits.length === 10) {
    return `1${digits}`;
  }

  return digits;
}

export function formatPhoneForFirebase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('+')) {
    const digits = normalizePhoneForComparison(trimmed);
    return digits ? `+${digits}` : '';
  }

  const digits = normalizePhoneForComparison(trimmed);
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (digits.length >= 11) {
    return `+${digits}`;
  }

  return '';
}

export function formatPhoneForDisplay(value: string) {
  const e164 = formatPhoneForFirebase(value);
  if (!e164) {
    return value.trim();
  }

  const digits = e164.replace(NON_DIGIT_PATTERN, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return e164;
}

export function maskPhoneForOtp(value: string) {
  const e164 = formatPhoneForFirebase(value);
  if (!e164) {
    return 'your phone';
  }

  const digits = e164.replace(NON_DIGIT_PATTERN, '');
  const lastFour = digits.slice(-4);
  const country = e164.startsWith('+1') ? '+1' : e164.split(lastFour)[0] || '+';

  return `${country} •••• ${lastFour}`;
}
