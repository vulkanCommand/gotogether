import { firebaseAuth } from './firebase';
import { useAuthStore } from '../store/authStore';

const defaultApiBaseUrl = 'https://gotogether-backend-501556960072.us-central1.run.app';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl).replace(/\/+$/, '');

export type ApiTrip = {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  created_by?: number;
  members_count?: number;
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
  return apiRequest<{ user: { id: number; firebase_uid: string; email: string; name: string } }>(
    '/api/me',
    { method: 'GET' }
  );
}
