const FRIENDLY_EDIT_ERROR = 'Please edit this text before saving.';

const BLOCKED_TERM_PATTERNS = [
  /\b(?:fuck|fucking|fucked)\b/i,
  /\b(?:shit|shitty)\b/i,
  /\b(?:bitch|bitches)\b/i,
  /\basshole\b/i,
  /\bcunt\b/i,
  /\b(?:fag|faggot)\b/i,
  /\b(?:nigger|nigga)\b/i,
];

export type UserTextValidationOptions = {
  required?: boolean;
  maxLength?: number;
};

export type UserTextValidationResult = {
  ok: boolean;
  value: string;
  error?: string;
  reason?: 'required' | 'tooLong' | 'unsafe';
};

export const cleanUserText = (value: string) => value.trim();

export const validateUserText = (
  value: string,
  options: UserTextValidationOptions = {}
): UserTextValidationResult => {
  const cleanedValue = cleanUserText(value);

  if (options.required && cleanedValue.length === 0) {
    return {
      ok: false,
      value: cleanedValue,
      reason: 'required',
    };
  }

  if (options.maxLength && cleanedValue.length > options.maxLength) {
    return {
      ok: false,
      value: cleanedValue,
      error: FRIENDLY_EDIT_ERROR,
      reason: 'tooLong',
    };
  }

  if (cleanedValue && BLOCKED_TERM_PATTERNS.some((pattern) => pattern.test(cleanedValue))) {
    return {
      ok: false,
      value: cleanedValue,
      error: FRIENDLY_EDIT_ERROR,
      reason: 'unsafe',
    };
  }

  return {
    ok: true,
    value: cleanedValue,
  };
};

export const TEXT_SAFETY_ERROR_MESSAGE = FRIENDLY_EDIT_ERROR;
