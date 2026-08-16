const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

/**
 * Wrapper around fetch that attaches the auth token and handles errors.
 */
async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers,
    ...rest,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${response.status}`);
  }

  return response.json();
}

// ─── Auth ──────────────────────────────────────
export const authApi = {
  signup: (email: string, password: string, full_name: string) =>
    apiFetch<{ user: { id: string; email: string }; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ user: { id: string; email: string; role: string }; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiFetch('/auth/me'),
};

// ─── Reports ───────────────────────────────────
export const reportsApi = {
  createLost: (data: Record<string, unknown>) =>
    apiFetch('/reports/lost', { method: 'POST', body: JSON.stringify(data) }),

  createFound: (data: Record<string, unknown>) =>
    apiFetch('/reports/found', { method: 'POST', body: JSON.stringify(data) }),

  getById: (id: string) =>
    apiFetch(`/reports/${id}`),

  getByUser: (userId: string) =>
    apiFetch<{ lost: unknown[]; found: unknown[] }>(`/reports/user/${userId}`),
};

// ─── Matches ───────────────────────────────────
export const matchesApi = {
  run: (reportId: string, type: 'lost' | 'found') =>
    apiFetch<{ matches: unknown[]; match_count: number }>(`/matches/run/${reportId}?type=${type}`, {
      method: 'POST',
    }),

  getByReport: (reportId: string, type: 'lost' | 'found') =>
    apiFetch<unknown[]>(`/matches/${reportId}?type=${type}`),
};

// ─── Verification ──────────────────────────────
export const verifyApi = {
  getQuestion: (matchId: string) =>
    apiFetch<{ question_id: string; question_text: string }>(`/verify/${matchId}/question`),

  submitAnswer: (matchId: string, answer: string) =>
    apiFetch(`/verify/${matchId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),

  judgeAnswer: (matchId: string, is_correct: boolean, attempt_id: string) =>
    apiFetch(`/verify/${matchId}/judge`, {
      method: 'POST',
      body: JSON.stringify({ is_correct, attempt_id }),
    }),
};

// ─── Notifications ─────────────────────────────
export const notificationsApi = {
  getAll: (page = 1, unreadOnly = false) =>
    apiFetch<{ notifications: unknown[]; unread_count: number }>(
      `/notifications?page=${page}&unread=${unreadOnly}`
    ),

  markRead: (id: string) =>
    apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiFetch('/notifications/read-all', { method: 'PATCH' }),
};

// ─── Admin ─────────────────────────────────────
export const adminApi = {
  getStats: () => apiFetch('/admin/stats'),

  getMatches: (page = 1, status?: string) =>
    apiFetch<{ matches: unknown[] }>(
      `/admin/matches?page=${page}${status ? `&status=${status}` : ''}`
    ),

  approveMatch: (id: string) =>
    apiFetch(`/admin/matches/${id}/approve`, { method: 'POST' }),

  rejectMatch: (id: string) =>
    apiFetch(`/admin/matches/${id}/reject`, { method: 'POST' }),

  updateItemStatus: (id: string, status: string, type: 'lost' | 'found', reason?: string) =>
    apiFetch(`/admin/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, type, reason }),
    }),
};
