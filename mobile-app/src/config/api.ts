import { firebaseAuth } from './firebase';
import { AppUser, useAuthStore } from '../store/authStore';
import { Friend } from '../store/friendStore';

const defaultApiBaseUrl = 'https://gotogether-backend-501556960072.us-central1.run.app';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl).replace(/\/+$/, '');

export type ApiTripMember = {
  id: number;
  name: string;
  role?: string;
  available_dates?: string[];
  lead_vote_user_id?: number;
  setup_completed_at?: string;
  is_viewer?: boolean;
  proposal_status?: 'confirmed' | 'needs_response' | 'waiting' | string;
};

export type ApiTrip = {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  created_by?: number;
  members_count?: number;
  image_url?: string;
  completed_at?: string;
  viewer_role?: string;
  lead_user_id?: number;
  setup_completed_count?: number;
  setup_pending_count?: number;
  setup_required?: boolean;
  readiness_status?: 'completed' | 'needs_your_response' | 'waiting_on_crew' | 'ready' | string;
  completion_confirmed_count?: number;
  completion_pending_count?: number;
  completion_requested?: boolean;
};

export type ApiTripDetails = {
  trip: ApiTrip;
  members: ApiTripMember[];
  permissions?: {
    can_edit_trip: boolean;
    can_edit_itinerary: boolean;
    can_complete_trip: boolean;
  };
};

export type ApiTripCoverResult = {
  image_url: string;
  source: string;
};

export type ApiDestinationBrief = {
  vibe: string;
  ideal_for: string;
  pace: string;
  highlights: string[];
  planning_tips: string[];
};

export type ApiExpense = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  paidByUserId?: number;
  expenseGroupId?: number;
  linkedEventId?: string;
  linkedEventTitle?: string;
  linkedDayTitle?: string;
  splitMethod: string;
  notes: string;
  createdAt: string;
  splitPreview: Array<{
    memberId: string;
    memberName: string;
    amount: number;
  }>;
};

export type ApiExpenseGroup = {
  id: number;
  tripId: number;
  name: string;
  createdAt: string;
  expenses: ApiExpense[];
};

export type ApiTripLocation = {
  user_id: number;
  name: string;
  email: string;
  profile_image_url: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  updated_at: string;
  is_current_user: boolean;
};

export type ApiTripPhoto = {
  id: number;
  image_url: string;
  caption: string;
  uploaded_by: string;
  uploaded_at: string;
};

export type ApiNotification = {
  id: number;
  tripId: number;
  title: string;
  body: string;
  kind: string;
  requiresAction: boolean;
  actionType: string;
  targetId: number;
  actionLabel?: string;
  targetTitle?: string;
  actionCompletedAt: string;
  createdAt: string;
};

export type ApiPlaceResult = {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  provider: string;
  display_name: string;
};

type NominatimPlaceResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export type ApiSMSInviteResult = {
  sent: boolean;
  recipient_phone: string;
  provider: string;
  message_sid: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: any = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('Backend returned invalid JSON');
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

async function buildHeaders(options: RequestInit = {}, token?: string | null) {
  const isFormDataBody =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function isInvalidTokenError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('invalid token') || normalized.includes('token is malformed') || normalized.includes('401');
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authStore = useAuthStore.getState();
  let token = authStore.token;

  const doFetch = async (activeToken?: string | null) => {
    const headers = await buildHeaders(options, activeToken);
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  };

  let response = await doFetch(token);

  if (response.ok) {
    return parseResponse<T>(response);
  }

  const raw = await response.text();
  let parsed: any = {};

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { error: raw };
    }
  }

  const errorMessage = parsed?.error || `Request failed with status ${response.status}`;

  if (response.status === 401 || isInvalidTokenError(errorMessage)) {
    const currentUser = firebaseAuth.currentUser;

    if (currentUser) {
      try {
        const refreshedToken = await currentUser.getIdToken(true);
        useAuthStore.getState().setSession(refreshedToken);
        token = refreshedToken;
        response = await doFetch(token);

        if (response.ok) {
          return parseResponse<T>(response);
        }
      } catch {
        useAuthStore.getState().clearSession();
      }
    } else {
      useAuthStore.getState().clearSession();
    }
  }

  if (response.status === 401) {
    useAuthStore.getState().clearSession();
  }

  if (response.bodyUsed) {
    throw new Error(errorMessage);
  }

  return parseResponse<T>(response);
}

export async function syncAuthenticatedUser() {
  return apiRequest<{ user: AppUser }>('/api/me', { method: 'GET' });
}

export async function updateMyProfile(payload: {
  name: string;
  phone?: string;
  username?: string;
  home_city?: string;
  bio?: string;
}) {
  return apiRequest<{ user: AppUser }>('/api/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateMyProfileImage(payload: {
  photo: { uri: string; name: string; type: string };
}) {
  const formData = new FormData();
  formData.append('photo', payload.photo as any);

  return apiRequest<{ user: AppUser }>('/api/me/profile-image', {
    method: 'POST',
    body: formData,
  });
}

export async function deleteMyProfileImage() {
  return apiRequest<{ user: AppUser }>('/api/me/profile-image', {
    method: 'DELETE',
  });
}

export async function deleteMyAccount() {
  return apiRequest<{ deleted: boolean; auth_deleted: boolean }>('/api/me', {
    method: 'DELETE',
  });
}

export async function registerPushToken(payload: { token: string; platform: string }) {
  return apiRequest<{ saved: boolean }>('/api/me/push-token', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function unregisterPushToken(payload: { token: string }) {
  return apiRequest<{ removed: boolean }>('/api/me/push-token', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export async function syncDeviceContacts(payload: { emails: string[]; phones: string[] }) {
  return apiRequest<{ friends: Friend[] }>('/api/contacts/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchFriends() {
  return apiRequest<{ friends: Friend[] }>('/api/friends');
}

export async function sendSMSInvite(payload: { phone: string; name?: string }) {
  return apiRequest<ApiSMSInviteResult>('/api/friends/invite-sms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchTripDetails(tripId: number) {
  return apiRequest<ApiTripDetails>(`/api/trips/${tripId}`);
}

export async function fetchTrips() {
  return apiRequest<{ trips: ApiTrip[] }>('/api/trips');
}

export async function saveTripItinerary(tripId: number, days: import('../store/tripStore').ItineraryDay[]) {
  return apiRequest<{ message: string }>(`/api/trips/${tripId}/itinerary`, {
    method: 'PUT',
    body: JSON.stringify({ days }),
  });
}

export async function updateTrip(
  tripId: number,
  payload: { name: string; destination: string; start_date: string; end_date: string }
) {
  return apiRequest<{ updated: boolean }>(`/api/trips/${tripId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteTrip(tripId: number) {
  return apiRequest<{ deleted: boolean }>(`/api/trips/${tripId}`, {
    method: 'DELETE',
  });
}

export async function fetchTripSetupStatus(tripId: number) {
  return apiRequest<{
    viewerRole: string;
    required: boolean;
    availableDates: string[];
    leadVoteUserId: number;
    completedAt: string;
  }>(`/api/trips/${tripId}/setup-status`);
}

export async function saveTripSetupStatus(
  tripId: number,
  payload: { availableDates: string[]; leadVoteUserId: number }
) {
  return apiRequest<{ completed: boolean }>(`/api/trips/${tripId}/setup-status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchNotifications() {
  return apiRequest<{ notifications: ApiNotification[] }>('/api/notifications');
}

export async function clearNotification(notificationId: number) {
  return apiRequest<{ cleared: boolean }>(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
  });
}

export async function clearAllNotifications() {
  return apiRequest<{ cleared: boolean }>('/api/notifications', {
    method: 'DELETE',
  });
}

export async function acceptNotificationAction(notificationId: number) {
  return apiRequest<{ accepted: boolean; stale?: boolean }>(`/api/notifications/${notificationId}/accept`, {
    method: 'POST',
  });
}

export async function fetchExpenseGroups(tripId: number) {
  return apiRequest<{ groups: ApiExpenseGroup[] }>(`/api/trips/${tripId}/expense-groups`);
}

export async function createExpenseGroup(tripId: number, payload: { name: string }) {
  return apiRequest<{ group: ApiExpenseGroup }>(`/api/trips/${tripId}/expense-groups`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type SaveExpensePayload = {
  title: string;
  amount: number;
  paidByUserId: number;
  expenseGroupId: number;
  linkedEventId?: string;
  splitMethod: string;
  notes?: string;
  splitPreview: Array<{
    memberId: string;
    memberName: string;
    amount: number;
  }>;
};

export async function createTripExpense(tripId: number, payload: SaveExpensePayload) {
  return apiRequest<{ expense: ApiExpense }>(`/api/trips/${tripId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTripExpense(tripId: number, expenseId: string, payload: SaveExpensePayload) {
  return apiRequest<{ expense: ApiExpense }>(`/api/trips/${tripId}/expenses/${expenseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteTripExpense(tripId: number, expenseId: string) {
  return apiRequest<{ deleted: boolean }>(`/api/trips/${tripId}/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}

export async function updateTripLocation(
  tripId: number,
  payload: { latitude: number; longitude: number; accuracy: number }
) {
  return apiRequest<{ updated: boolean }>(`/api/trips/${tripId}/location`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchTripLiveLocations(tripId: number) {
  return apiRequest<{ locations: ApiTripLocation[] }>(`/api/trips/${tripId}/live`);
}

export async function searchPlaces(query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { results: [] as ApiPlaceResult[] };
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(trimmedQuery)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Place search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as NominatimPlaceResult[];
  const results: ApiPlaceResult[] = payload.map((item) => {
    const [title, ...rest] = item.display_name.split(',');
    return {
      id: `osm-${item.place_id}`,
      title: title?.trim() || item.display_name,
      subtitle: rest.join(',').trim(),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      provider: 'openstreetmap',
      display_name: item.display_name,
    };
  });

  return { results };
}

export async function fetchTripPhotos(tripId: number) {
  return apiRequest<{ photos: ApiTripPhoto[] }>(`/api/trips/${tripId}/photos`);
}

export async function createTripPhoto(
  tripId: number,
  payload: { photo: { uri: string; name: string; type: string }; caption?: string }
) {
  const formData = new FormData();
  formData.append('caption', payload.caption ?? '');
  formData.append('photo', payload.photo as any);

  return apiRequest<{ photo: ApiTripPhoto }>(`/api/trips/${tripId}/photos`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteTripPhoto(tripId: number, photoId: number) {
  return apiRequest<{ deleted: boolean }>(`/api/trips/${tripId}/photos/${photoId}`, {
    method: 'DELETE',
  });
}

export async function updateTripCover(
  tripId: number,
  payload: { photo: { uri: string; name: string; type: string } }
) {
  const formData = new FormData();
  formData.append('photo', payload.photo as any);

  return apiRequest<{ image_url: string }>(`/api/trips/${tripId}/cover`, {
    method: 'POST',
    body: formData,
  });
}

export async function ensureTripCoverFromDestination(tripId: number) {
  return apiRequest<ApiTripCoverResult>(`/api/trips/${tripId}/cover/auto`, {
    method: 'POST',
  });
}

export async function fetchDestinationBrief(tripId: number) {
  return apiRequest<{ brief: ApiDestinationBrief }>(`/api/trips/${tripId}/destination-brief`);
}

export async function generateItineraryDraft(tripId: number, payload: { notes?: string }) {
  return apiRequest<{ days: import('../store/tripStore').ItineraryDay[] }>(`/api/trips/${tripId}/itinerary/ai-draft`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createItineraryDay(
  tripId: number,
  payload: { title: string; dateLabel: string }
) {
  return apiRequest<{ day: import('../store/tripStore').ItineraryDay }>(`/api/trips/${tripId}/itinerary/days`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateItineraryDay(
  tripId: number,
  dayId: string,
  payload: { title: string; dateLabel: string }
) {
  const numericDayId = dayId.replace('day-', '');
  return apiRequest<{ updated: boolean }>(`/api/trips/${tripId}/itinerary/days/${numericDayId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteItineraryDay(tripId: number, dayId: string) {
  const numericDayId = dayId.replace('day-', '');
  return apiRequest<{ deleted: boolean }>(`/api/trips/${tripId}/itinerary/days/${numericDayId}`, {
    method: 'DELETE',
  });
}

export async function createItineraryEvent(
  tripId: number,
  dayId: string,
  payload: {
    title: string;
    time: string;
    location: string;
    locationIsMapped?: boolean;
    notes?: string;
    attendees?: string[];
    status?: string;
  }
) {
  const numericDayId = dayId.replace('day-', '');
  return apiRequest<{ event: import('../store/tripStore').ItineraryEvent }>(
    `/api/trips/${tripId}/itinerary/days/${numericDayId}/events`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function reorderItineraryDayEvents(tripId: number, dayId: string, eventIds: string[]) {
  const numericDayId = dayId.replace('day-', '');
  return apiRequest<{ days: import('../store/tripStore').ItineraryDay[] }>(
    `/api/trips/${tripId}/itinerary/days/${numericDayId}/events/reorder`,
    {
      method: 'POST',
      body: JSON.stringify({ eventIds }),
    }
  );
}

export async function updateItineraryEvent(
  tripId: number,
  eventId: string,
  payload: {
    title: string;
    time: string;
    location: string;
    locationIsMapped?: boolean;
    notes?: string;
    attendees?: string[];
  }
) {
  const numericEventId = eventId.replace('event-', '');
  return apiRequest<{ updated: boolean }>(`/api/trips/${tripId}/itinerary/events/${numericEventId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteItineraryEvent(tripId: number, eventId: string) {
  const numericEventId = eventId.replace('event-', '');
  return apiRequest<{ deleted: boolean }>(`/api/trips/${tripId}/itinerary/events/${numericEventId}`, {
    method: 'DELETE',
  });
}

export async function completeItineraryEvent(tripId: number, eventId: string) {
  const numericEventId = eventId.replace('event-', '');
  return apiRequest<{ days: import('../store/tripStore').ItineraryDay[] }>(
    `/api/trips/${tripId}/itinerary/events/${numericEventId}/complete`,
    {
      method: 'POST',
    }
  );
}

export async function reopenItineraryEvent(tripId: number, eventId: string) {
  const numericEventId = eventId.replace('event-', '');
  return apiRequest<{ days: import('../store/tripStore').ItineraryDay[] }>(
    `/api/trips/${tripId}/itinerary/events/${numericEventId}/undo-complete`,
    {
      method: 'POST',
    }
  );
}

export async function deleteTripCover(tripId: number) {
  return apiRequest<{ removed: boolean }>(`/api/trips/${tripId}/cover`, {
    method: 'DELETE',
  });
}

export async function completeTrip(tripId: number) {
  return apiRequest<{ completed: boolean; pending_confirmations?: boolean }>(`/api/trips/${tripId}/complete`, {
    method: 'POST',
  });
}

export function tripCoverFileUrl(tripId: number) {
  return `${API_BASE_URL}/api/trips/${tripId}/cover/file`;
}

export function profileImageFileUrl() {
  return `${API_BASE_URL}/api/me/profile-image/file`;
}

export function userProfileImageFileUrl(userId: number) {
  return `${API_BASE_URL}/api/users/${userId}/profile-image/file`;
}
