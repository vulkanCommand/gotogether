import { ApiActivityItem, ApiNotification } from '../config/api';

export type NotificationDisplayCategory = 'trips' | 'expenses' | 'other';

export type NotificationDisplay = {
  title: string;
  body: string;
  category: NotificationDisplayCategory;
  type: string;
  tripId?: number;
};

function cleanText(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '')
    .trim();
}

function formatTimestamp(value?: string) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  let hours = parsedDate.getHours();
  const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;

  return `${month}/${day} - ${hours}:${minutes}${period}`;
}

function appendTimestamp(body: string, value?: string) {
  const timestamp = formatTimestamp(value);
  return timestamp ? `${body} ${timestamp}` : body;
}

function extractTargetEventName(targetTitle?: string) {
  if (!targetTitle) {
    return '';
  }

  const parts = targetTitle
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[parts.length - 1] || targetTitle.trim();
}

function titleCase(value: string) {
  if (!value) {
    return '';
  }

  const normalized = cleanText(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function extractCompletedEventName(rawBody: string, targetEventName: string, rawTitle: string) {
  const directMatch =
    rawBody.match(/^(?:You|.+?)\s+marked\s+(.+?)\s+complete(?:d)?$/i) ||
    rawBody.match(/^(.+?)\s+(?:was\s+)?completed$/i);

  if (directMatch?.[1]) {
    return cleanText(directMatch[1]);
  }

  if (targetEventName) {
    return targetEventName;
  }

  if (rawTitle && !rawTitle.toLowerCase().includes('event completed')) {
    return cleanText(rawTitle);
  }

  return '';
}

function extractAddedEventName(rawTitle: string, rawBody: string, targetEventName: string) {
  const titleMatch = rawTitle.match(/^(.+?)\s+added\s+to\s+events$/i);
  if (titleMatch?.[1]) {
    return cleanText(titleMatch[1]);
  }

  const bodyMatch =
    rawBody.match(/^(.+?)\s+was\s+added\s+to\s+the\s+trip\s+plan$/i) ||
    rawBody.match(/^(?:event\s+added\s+by\s+.+?:?\s*)(.+)$/i);

  if (bodyMatch?.[1]) {
    return cleanText(bodyMatch[1]);
  }

  if (targetEventName) {
    return targetEventName;
  }

  if (rawTitle && !rawTitle.toLowerCase().includes('event added')) {
    return cleanText(rawTitle);
  }

  return '';
}

function extractExpenseTitle(item: ApiNotification | ApiActivityItem, rawTitle: string, rawBody: string) {
  const dataTitle = cleanText(String((item.data as any)?.expenseTitle || (item.data as any)?.title || ''));
  if (dataTitle) {
    return dataTitle;
  }

  const targetTitle = cleanText(item.targetTitle || '');
  if (targetTitle) {
    return targetTitle;
  }

  if (rawTitle && !rawTitle.toLowerCase().includes('expense')) {
    return rawTitle;
  }

  const bodyMatch = rawBody.match(/^(.+?)\s+(?:was\s+)?added$/i);
  if (bodyMatch?.[1]) {
    return cleanText(bodyMatch[1]);
  }

  return 'Expense updated';
}

function extractTripTitle(item: ApiNotification | ApiActivityItem, rawTitle: string) {
  const dataTitle = cleanText(String((item.data as any)?.tripTitle || (item.data as any)?.title || ''));
  if (dataTitle) {
    return dataTitle;
  }

  if (rawTitle && !rawTitle.toLowerCase().includes('trip update')) {
    return rawTitle;
  }

  return 'Trip update';
}

export function formatNotificationDisplay(item: ApiNotification | ApiActivityItem): NotificationDisplay {
  const rawTitle = cleanText(item.title || '');
  const rawBody = cleanText(item.body || '');
  const targetEventName = extractTargetEventName(item.targetTitle);
  const timestampValue = (item as any).createdAt || (item as any).created_at || (item as any).created_at_text || '';
  const type = String((item.data as any)?.type || item.type || item.kind || '').toLowerCase();
  const tripId = Number((item.data as any)?.tripId ?? item.tripId ?? 0) || undefined;

  if (type.includes('expense') || type.includes('settlement')) {
    const expenseTitle = extractExpenseTitle(item, rawTitle, rawBody);
    return {
      title: titleCase(expenseTitle),
      body: appendTimestamp(rawBody || 'Expense activity is ready', timestampValue),
      category: 'expenses',
      type,
      tripId,
    };
  }

  if (type.includes('trip_added')) {
    return {
      title: rawTitle || 'You were added to a trip',
      body: appendTimestamp(rawBody || 'A trip invite is waiting for you', timestampValue),
      category: 'trips',
      type,
      tripId,
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
    const eventName = extractCompletedEventName(rawBody, targetEventName, rawTitle);
    return {
      title: eventName ? `${titleCase(eventName)} completed` : 'Itinerary updated',
      body: appendTimestamp(rawBody || 'An itinerary event was completed', timestampValue),
      category: 'trips',
      type,
      tripId,
    };
  }

  const isEventAdded =
    titleLower.includes('event added') ||
    titleLower.includes('added event') ||
    titleLower.includes('new event') ||
    titleLower.includes('added to events') ||
    bodyLower.includes(' was added to the trip plan') ||
    bodyLower.startsWith('event added by');

  if (isEventAdded) {
    const eventName = extractAddedEventName(rawTitle, rawBody, targetEventName);
    return {
      title: eventName ? `${titleCase(eventName)} added` : 'Itinerary updated',
      body: appendTimestamp(rawBody || 'A new itinerary event was added', timestampValue),
      category: 'trips',
      type,
      tripId,
    };
  }

  if (type.includes('trip')) {
    const tripTitle = extractTripTitle(item, rawTitle);
    return {
      title: titleCase(tripTitle),
      body: appendTimestamp(rawBody || 'A trip update is waiting for you', timestampValue),
      category: 'trips',
      type,
      tripId,
    };
  }

  return {
    title: rawTitle || 'Trip activity',
    body: appendTimestamp(rawBody || 'New activity was added', timestampValue),
    category: 'other',
    type,
    tripId,
  };
}
