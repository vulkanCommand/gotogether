import { firebaseAuth } from './firebase';
import { AppUser, useAuthStore } from '../store/authStore';
import { Friend } from '../store/friendStore';

const defaultApiBaseUrl = 'https://gotogether-backend-501556960072.us-central1.run.app';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl).replace(/\/+$/, '');

export type ApiTripMember = {
  id: number;
  name: string;
  role?: string;
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
  username: string;
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

export async function syncDeviceContacts(payload: { emails: string[]; phones: string[] }) {
  return apiRequest<{ friends: Friend[] }>('/api/contacts/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchFriends() {
  return apiRequest<{ friends: Friend[] }>('/api/friends');
}

export async function fetchTripDetails(tripId: number) {
  return apiRequest<ApiTripDetails>(`/api/trips/${tripId}`);
}

export async function fetchTrips() {
  return apiRequest<{ trips: ApiTrip[] }>('/api/trips');
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
