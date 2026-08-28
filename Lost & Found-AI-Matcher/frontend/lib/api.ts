const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

/**
 * Resolves the auth token from the explicit param or localStorage.
 */
function resolveAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
  }
  return headers;
}

/**
 * Wrapper around fetch that attaches the auth token and handles errors.
 */
async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...resolveAuthHeaders(token),
    ...(customHeaders as Record<string, string>),
  };

  const response = await fetch(`${API_URL}${endpoint}`, { headers, ...rest });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Multipart upload variant — omits Content-Type so the browser sets the
 * boundary automatically for FormData.
 */
async function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const headers = resolveAuthHeaders();

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Upload error: ${response.status}`);
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
  /**
   * Upload a photo to the backend. Returns the public Supabase Storage URL.
   */
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiUpload<{ photo_url: string }>('/reports/upload', formData);
  },

  createLost: (data: Record<string, unknown>) =>
    apiFetch('/reports/lost', { method: 'POST', body: JSON.stringify(data) }),

  createFound: (data: Record<string, unknown>) =>
    apiFetch('/reports/found', { method: 'POST', body: JSON.stringify(data) }),

  getById: (id: string) =>
    apiFetch(`/reports/${id}`),

  /**
   * Public view of a found item — private_details is null for non-owners.
   */
  getPublicFoundItem: (id: string) =>
    apiFetch<{
      id: string;
      category: string;
      brand: string | null;
      colour: string | null;
      description: string;
      location: string;
      found_at: string;
      photo_url: string | null;
      status: string;
      private_details: Record<string, string> | null;
    }>(`/reports/found/${id}`),

  getByUser: (userId: string) =>
    apiFetch<{ lost: unknown[]; found: unknown[] }>(`/reports/user/${userId}`),

  /**
   * List all active reports, paginated.
   * @param type  'lost' | 'found' | 'all' (default 'all')
   */
  listAll: (page = 1, limit = 20, type: 'lost' | 'found' | 'all' = 'all') =>
    apiFetch<{
      lost: unknown[];
      found: unknown[];
      pagination: { page: number; limit: number; total_lost: number; total_found: number };
    }>(`/reports?page=${page}&limit=${limit}&type=${type}`),
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
export interface VerificationAnswerResult {
  attempt_id: string;
  attempt_number: number;
  result: 'correct' | 'incorrect' | 'escalated';
  message: string;
  retries_remaining?: number;
  new_question?: { question_id: string; question_text: string } | null;
}

export interface VerificationJudgeResult {
  result: 'correct' | 'incorrect' | 'escalated';
  message: string;
  retries_remaining?: number;
  new_question?: { question_id: string; question_text: string } | null;
}

export const verifyApi = {
  getQuestion: (matchId: string) =>
    apiFetch<{ question_id: string; question_text: string }>(`/verify/${matchId}/question`),

  submitAnswer: (matchId: string, answer: string) =>
    apiFetch<VerificationAnswerResult>(`/verify/${matchId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),

  judgeAnswer: (matchId: string, is_correct: boolean, attempt_id: string) =>
    apiFetch<VerificationJudgeResult>(`/verify/${matchId}/judge`, {
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

// ─── Messages ─────────────────────────────────
export const messagesApi = {
  /** Fetch all messages in the thread for a match. */
  getThread: (matchId: string) =>
    apiFetch<{ messages: import('../types').Message[] }>(`/messages/${matchId}`),

  /** Send a message in an approved match thread. */
  send: (matchId: string, body: string) =>
    apiFetch<import('../types').Message>(`/messages/${matchId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
};

// ─── Admin ─────────────────────────────────────
export interface DisputedMatch {
  id: string;
  total_score: number;
  status: string;
  fraud_flag: boolean;
  flag_reason: string | null;
  flagged_at: string | null;
  created_at: string;
  lost_id: string;
  lost_category: string;
  lost_desc: string;
  claimant_id: string;
  claimant_name: string;
  claimant_email: string;
  found_id: string;
  found_category: string;
  found_desc: string;
  finder_id: string;
  finder_name: string;
  finder_email: string;
  questions: Array<{
    id: string;
    match_id: string;
    question_text: string;
    correct_answer: string;
    field_source: string;
  }>;
  attempts: Array<{
    id: string;
    match_id: string;
    attempt_number: number;
    answer_text: string;
    is_correct: boolean | null;
    judged_at: string | null;
  }>;
}

export const adminApi = {
  getStats: () => apiFetch('/admin/stats'),

  getMatches: (page = 1, status?: string) =>
    apiFetch<{ page: number; limit: number; matches: unknown[] }>(
      `/admin/matches?page=${page}${status ? `&status=${status}` : ''}`
    ),

  approveMatch: (id: string) =>
    apiFetch(`/admin/matches/${id}/approve`, { method: 'POST' }),

  rejectMatch: (id: string) =>
    apiFetch(`/admin/matches/${id}/reject`, { method: 'POST' }),

  flagMatch: (id: string, reason: string) =>
    apiFetch(`/admin/matches/${id}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  unflagMatch: (id: string) =>
    apiFetch(`/admin/matches/${id}/unflag`, { method: 'POST' }),

  getDisputed: (page = 1) =>
    apiFetch<{ page: number; limit: number; total: number; matches: DisputedMatch[] }>(
      `/admin/disputed?page=${page}`
    ),

  updateItemStatus: (id: string, status: string, type: 'lost' | 'found', reason?: string) =>
    apiFetch(`/admin/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, type, reason }),
    }),
};
