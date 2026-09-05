const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface FetchOptions extends RequestInit {
  token?: string;
  skipAuth?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The API runs on Render's free tier and sleeps when idle. The first request to a
// sleeping instance fails with "Failed to fetch" while it boots, so retry with
// backoff delays. Only the deployed backend is retried — local development fails
// fast instead of waiting when the backend is simply not running.
const shouldRetry = API_URL.includes('onrender.com');
const RETRY_DELAYS_MS = [10000, 15000, 20000, 30000];

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, init);
      // Render's proxy answers 502/503 with an HTML page while the free-tier
      // instance boots or redeploys. Treat those like a network failure so the
      // request keeps retrying instead of surfacing "API error: 502".
      if (
        shouldRetry &&
        (response.status === 502 || response.status === 503 || response.status === 504) &&
        attempt < RETRY_DELAYS_MS.length
      ) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return response;
    } catch (err) {
      if (!shouldRetry) {
        throw err;
      }
      if (attempt >= RETRY_DELAYS_MS.length) {
        throw new Error('The server is still waking up. Please wait a minute and try again.');
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

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

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, skipAuth, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(skipAuth ? {} : resolveAuthHeaders(token)),
    ...(customHeaders as Record<string, string>),
  };

  const response = await fetchWithRetry(`${API_URL}${endpoint}`, { headers, ...rest });
  

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${response.status}`);
  }

  return response.json();
}

async function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const headers = resolveAuthHeaders();

  const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
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

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    full_name?: string;
    role: 'user' | 'admin';
    preferred_lang?: string;
    created_at?: string;
  };
  token: string;
}

export const authApi = {
  signup: (email: string, password: string, full_name: string) =>
    apiFetch<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
      skipAuth: true,
    }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),
};

export interface CreateLostReportRequest {
  category: string;
  description: string;
  location: string;
  lost_at: string;
  brand?: string | null;
  colour?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
  identifying_info?: string | null;
}

export interface CreateFoundReportRequest {
  category: string;
  description: string;
  location: string;
  found_at: string;
  brand?: string | null;
  colour?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
  private_details?: Record<string, string> | null;
}

export interface SimilarItem {
  id: string;
  category: string;
  brand: string | null;
  colour: string | null;
  description: string;
  location: string;
  photo_url: string | null;
  similarity_score: number;
}

export interface ReportResponse {
  id: string;
  category: string;
  brand: string | null;
  colour: string | null;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  lost_at?: string;
  found_at?: string;
  event_time?: string;
  photo_url: string | null;
  status: string;
  created_at: string;
  type?: 'lost' | 'found';
  matches?: MatchRunResult[];
  similar_found_items?: SimilarItem[];
  similar_lost_items?: SimilarItem[];
}

export interface UserReportsResponse {
  lost: ReportResponse[];
  found: ReportResponse[];
}

export const reportsApi = {
  uploadPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    const data = await apiUpload<{ photo_url: string }>('/reports/upload', formData);
    return { photo_url: data.photo_url };
  },

  createLost: (data: Record<string, unknown>) =>
    apiFetch<ReportResponse>('/reports/lost', { method: 'POST', body: JSON.stringify(data) }),

  createFound: (data: Record<string, unknown>) =>
    apiFetch<ReportResponse>('/reports/found', { method: 'POST', body: JSON.stringify(data) }),

  getById: (id: string) => apiFetch<ReportResponse>(`/reports/${id}`),

  getByUser: (userId: string) =>
    apiFetch<UserReportsResponse>(`/reports/user/${userId}`),
};

export interface MatchRunResult {
  lost_item_id: string;
  found_item_id: string;
  total_score: number;
  desc_score: number;
  image_score: number;
  location_score: number;
  time_score: number;
  attr_score: number;
}

export interface RunMatchesResponse {
  report_id: string;
  match_count: number;
  matches: MatchRunResult[];
}

export interface MatchListItem {
  id: string;
  lost_item_id?: string;
  found_item_id?: string;
  total_score: number;
  desc_score: number;
  image_score: number;
  location_score: number;
  time_score: number;
  attr_score: number;
  status: string;
  created_at: string;
  found_id?: string;
  found_category?: string;
  found_brand?: string | null;
  found_colour?: string | null;
  found_description?: string;
  found_location?: string;
  found_photo_url?: string | null;
  found_at?: string;
  lost_id?: string;
  lost_category?: string;
  lost_brand?: string | null;
  lost_colour?: string | null;
  lost_description?: string;
  lost_location?: string;
  lost_photo_url?: string | null;
  lost_at?: string;
}

export const matchesApi = {
  run: (reportId: string, type: 'lost' | 'found') =>
    apiFetch<RunMatchesResponse>(`/matches/run/${reportId}?type=${type}`, {
      method: 'POST',
    }),

  getByReport: (reportId: string, type: 'lost' | 'found') =>
    apiFetch<MatchListItem[]>(`/matches/${reportId}?type=${type}`),
};

export interface VerificationQuestion {
  question_id: string;
  question_text: string;
}

export interface VerificationAnswerResponse {
  attempt_id: string;
  attempt_number: number;
  result: 'correct' | 'incorrect' | 'escalated';
  message: string;
  retries_remaining?: number;
  new_question?: VerificationQuestion | null;
}

export interface VerificationJudgeResponse {
  result: 'correct' | 'incorrect' | 'escalated';
  message: string;
  retries_remaining?: number;
  new_question?: VerificationQuestion | null;
}

export const verifyApi = {
  getQuestion: (matchId: string) =>
    apiFetch<VerificationQuestion>(`/verify/${matchId}/question`),

  submitAnswer: (matchId: string, answer: string) =>
    apiFetch<VerificationAnswerResponse>(`/verify/${matchId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),

  judgeAnswer: (matchId: string, is_correct: boolean, attempt_id: string) =>
    apiFetch<VerificationJudgeResponse>(`/verify/${matchId}/judge`, {
      method: 'POST',
      body: JSON.stringify({ is_correct, attempt_id }),
    }),
};

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  match_id: string | null;
  item_id: string | null;
  item_type: 'lost' | 'found' | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
  page: number;
  limit: number;
}

export const notificationsApi = {
  getAll: (page = 1, limit = 20, unreadOnly = false) =>
    apiFetch<NotificationsResponse>(
      `/notifications?page=${page}&limit=${limit}&unread=${unreadOnly}`
    ),

  markRead: (id: string) =>
    apiFetch<{ message: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiFetch('/notifications/read-all', { method: 'PATCH' }),

  getUnreadCount: () =>
    apiFetch<{ unread_count: number }>('/notifications/count'),
};

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface MessagesResponse {
  messages: Message[];
}

export const messagesApi = {
  getThread: (matchId: string) =>
    apiFetch<MessagesResponse>(`/messages/${matchId}`),

  send: (matchId: string, body: string) =>
    apiFetch<Message>(`/messages/${matchId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
};

export interface AdminStatsResponse {
  lost_items: { total: string; active: string };
  found_items: { total: string; active: string };
  matches: { total: string; pending: string; approved: string; disputed: string };
}

export interface AdminMatchListItem {
  id: string;
  total_score: number;
  status: string;
  fraud_flag: boolean;
  flag_reason: string | null;
  created_at: string;
  lost_id: string;
  lost_category: string;
  lost_desc: string;
  found_id: string;
  found_category: string;
  found_desc: string;
}

export interface AdminMatchesResponse {
  page: number;
  limit: number;
  matches: AdminMatchListItem[];
}

export interface AdminDisputedQuestion {
  id: string;
  match_id: string;
  question_text: string;
  correct_answer: string;
  field_source: string;
}

export interface AdminDisputedAttempt {
  id: string;
  match_id: string;
  attempt_number: number;
  answer_text: string;
  is_correct: boolean | null;
  judged_at: string | null;
}

export interface DisputedMatch extends AdminMatchListItem {
  claimant_id: string;
  claimant_name: string;
  claimant_email: string;
  finder_id: string;
  finder_name: string;
  finder_email: string;
  questions: AdminDisputedQuestion[];
  attempts: AdminDisputedAttempt[];
}

export interface AdminDisputedResponse {
  page: number;
  limit: number;
  total: number;
  matches: DisputedMatch[];
}

export const adminApi = {
  getStats: () => apiFetch<AdminStatsResponse>('/admin/stats'),

  getMatches: (page: number | string = 1, limitOrStatus?: number | string, status?: string) => {
    let limit = 20;
    let finalStatus: string | undefined;

    if (typeof limitOrStatus === 'string') {
      finalStatus = limitOrStatus;
    } else if (typeof limitOrStatus === 'number') {
      limit = limitOrStatus;
      finalStatus = status;
    }

    return apiFetch<AdminMatchesResponse>(
      `/admin/matches?page=${page}&limit=${limit}${finalStatus ? `&status=${finalStatus}` : ''}`
    );
  },

  approveMatch: (id: string) =>
    apiFetch<{ message: string }>(`/admin/matches/${id}/approve`, { method: 'POST' }),

  rejectMatch: (id: string) =>
    apiFetch<{ message: string }>(`/admin/matches/${id}/reject`, { method: 'POST' }),

  updateItemStatus: (
    id: string,
    body: { status: string; type: 'lost' | 'found'; reason?: string }
  ) =>
    apiFetch<{ message: string }>(`/admin/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getDisputed: (page = 1, limit = 20) =>
    apiFetch<AdminDisputedResponse>(`/admin/disputed?page=${page}&limit=${limit}`),

  flagMatch: (id: string, reason: string) =>
    apiFetch<{ message: string }>(`/admin/matches/${id}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  unflagMatch: (id: string) =>
    apiFetch<{ message: string }>(`/admin/matches/${id}/unflag`, { method: 'POST' }),
};