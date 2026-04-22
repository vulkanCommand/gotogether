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
};

export type ApiTripDetails = {
  trip: ApiTrip;
  members: ApiTripMember[];
};

export type ApiExpense = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  splitMethod: string;
  notes: string;
  createdAt: string;
  splitPreview: Array<{
    memberId: string;
    memberName: string;
    amount: number;
  }>;
};

export type ApiTripLocation = {
  user_id: number;
  name: string;
  email: string;
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
