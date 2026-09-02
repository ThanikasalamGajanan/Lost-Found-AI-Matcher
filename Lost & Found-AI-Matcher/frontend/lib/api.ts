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
  /**
   * Register a new user account.
   * Request body: { email, password, full_name }
   */
  signup: (email: string, password: string, full_name: string) =>
    apiFetch<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    }),

  /**
   * Log in an existing user.
   * Request body: { email, password }
   */
  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// ─── Reports ───────────────────────────────────

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
  /**
   * Returned by the matching-engine branch of the backend.
   */
  matches?: MatchRunResult[];
  /**
   * Returned by the embedding-search branch of the backend.
   */
  similar_found_items?: SimilarItem[];
  similar_lost_items?: SimilarItem[];
}

export interface UserReportsResponse {
  lost: ReportResponse[];
  found: ReportResponse[];
}

export const reportsApi = {
  /**
   * Upload a photo to the backend.
   * Backend endpoint: POST /api/upload
   * Backend returns: { url, fileName }
   * We also expose `photo_url` for backward compatibility with older form code.
   */
  uploadPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    const data = await apiUpload<{ url: string; fileName: string }>('/upload', formData);
    return { ...data, photo_url: data.url };
  },

  /**
   * Create a lost-item report.
   * Backend endpoint: POST /api/reports/lost
   */
  createLost: (data: Record<string, unknown>) =>
    apiFetch<ReportResponse>('/reports/lost', { method: 'POST', body: JSON.stringify(data) }),

  /**
   * Create a found-item report.
   * Backend endpoint: POST /api/reports/found
   */
  createFound: (data: Record<string, unknown>) =>
    apiFetch<ReportResponse>('/reports/found', { method: 'POST', body: JSON.stringify(data) }),

  /**
   * Get a single report by ID (lost or found).
   * Backend endpoint: GET /api/reports/:id
   */
  getById: (id: string) => apiFetch<ReportResponse>(`/reports/${id}`),

  /**
   * List all reports belonging to a user.
   * Backend endpoint: GET /api/reports/user/:userId
   */
  getByUser: (userId: string) =>
    apiFetch<UserReportsResponse>(`/reports/user/${userId}`),
};

// ─── Matches ───────────────────────────────────

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
  // When the report is a lost item, the API returns found_* fields.
  found_id?: string;
  found_category?: string;
  found_brand?: string | null;
  found_colour?: string | null;
  found_description?: string;
  found_location?: string;
  found_photo_url?: string | null;
  found_at?: string;
  // When the report is a found item, the API returns lost_* fields.
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
  /**
   * Trigger the full matching engine for a report.
   * Backend endpoint: POST /api/matches/run/:reportId?type=lost|found
   */
  run: (reportId: string, type: 'lost' | 'found') =>
    apiFetch<RunMatchesResponse>(`/matches/run/${reportId}?type=${type}`, {
      method: 'POST',
    }),

  /**
   * Get existing matches for a report.
   * Backend endpoint: GET /api/matches/:reportId?type=lost|found
   */
  getByReport: (reportId: string, type: 'lost' | 'found') =>
    apiFetch<MatchListItem[]>(`/matches/${reportId}?type=${type}`),
};

// ─── Verification ──────────────────────────────

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
  /**
   * Get the current verification question for a match.
   * Backend endpoint: GET /api/verify/:matchId/question
   */
  getQuestion: (matchId: string) =>
    apiFetch<VerificationQuestion>(`/verify/${matchId}/question`),

  /**
   * Submit an answer to the current verification question.
   * Backend endpoint: POST /api/verify/:matchId/answer
   */
  submitAnswer: (matchId: string, answer: string) =>
    apiFetch<VerificationAnswerResponse>(`/verify/${matchId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),

  /**
   * Finder (or admin) override for a verification attempt.
   * Backend endpoint: POST /api/verify/:matchId/judge
   */
  judgeAnswer: (matchId: string, is_correct: boolean, attempt_id: string) =>
    apiFetch<VerificationJudgeResponse>(`/verify/${matchId}/judge`, {
      method: 'POST',
      body: JSON.stringify({ is_correct, attempt_id }),
    }),
};

// ─── Notifications ─────────────────────────────

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
  /**
   * List the current user's notifications.
   * Backend endpoint: GET /api/notifications?page=&limit=&unread=
   */
  getAll: (page = 1, limit = 20, unreadOnly = false) =>
    apiFetch<NotificationsResponse>(
      `/notifications?page=${page}&limit=${limit}&unread=${unreadOnly}`
    ),

  /**
   * Mark a single notification as read.
   * Backend endpoint: PATCH /api/notifications/:id/read
   */
  markRead: (id: string) =>
    apiFetch<{ message: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),

  /**
   * Mark all notifications as read.
   * Backend endpoint: PATCH /api/notifications/read-all
   */
  markAllRead: () =>
    apiFetch<{ message: string }>('/notifications/read-all', { method: 'PATCH' }),
};

// ─── Messages ──────────────────────────────────

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
  /**
   * Fetch the message thread for an approved match.
   * Backend endpoint: GET /api/messages/:matchId
   */
  getMessages: (matchId: string) =>
    apiFetch<MessagesResponse>(`/messages/${matchId}`),

  /**
   * Send a message in a match thread.
   * Backend endpoint: POST /api/messages/:matchId
   */
  sendMessage: (matchId: string, body: string) =>
    apiFetch<Message>(`/messages/${matchId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
};

// ─── Admin ─────────────────────────────────────

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
  /**
   * Get admin dashboard statistics.
   * Backend endpoint: GET /api/admin/stats
   */
  getStats: () => apiFetch<AdminStatsResponse>('/admin/stats'),

  /**
   * List matches for admin review with optional status filter.
   * Backend endpoint: GET /api/admin/matches?page=&limit=&status=
   *
   * Signature accepts (page, status) for the existing admin page as well as
   * the documented (page, limit, status) order.
   */
  getMatches: (page: number | string = 1, limitOrStatus?: number | string, status?: string) => {
    let limit = 20;
    let finalStatus: string | undefined;

    if (typeof limitOrStatus === 'string') {
      // Called as getMatches(page, status)
      finalStatus = limitOrStatus;
    } else if (typeof limitOrStatus === 'number') {
      limit = limitOrStatus;
      finalStatus = status;
    }

    return apiFetch<AdminMatchesResponse>(
      `/admin/matches?page=${page}&limit=${limit}${finalStatus ? `&status=${finalStatus}` : ''}`
    );
  },

  /**
   * Approve a match.
   * Backend endpoint: POST /api/admin/matches/:id/approve
   */
  approveMatch: (id: string) =>
    apiFetch<{ message: string }>(`/admin/matches/${id}/approve`, { method: 'POST' }),

  /**
   * Reject a match.
   * Backend endpoint: POST /api/admin/matches/:id/reject
   */
  rejectMatch: (id: string) =>
    apiFetch<{ message: string }>(`/admin/matches/${id}/reject`, { method: 'POST' }),

  /**
   * Update an item's status (e.g. returned/closed).
   * Backend endpoint: PATCH /api/admin/items/:id/status
   */
  updateItemStatus: (
    id: string,
    body: { status: string; type: 'lost' | 'found'; reason?: string }
  ) =>
    apiFetch<{ message: string }>(`/admin/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  /**
   * List disputed / fraud-flagged matches with verification history.
   * Backend endpoint: GET /api/admin/disputed
   */
  getDisputed: (page = 1, limit = 20) =>
    apiFetch<AdminDisputedResponse>(`/admin/disputed?page=${page}&limit=${limit}`),

  /**
   * Flag a match as fraudulent.
   * Backend endpoint: POST /api/admin/matches/:id/flag
   */
  flagMatch: (id: string, reason: string) =>
    apiFetch<{ message: string }>(`/admin/matches/${id}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /**
   * Remove the fraud flag from a match.
   * Backend endpoint: POST /api/admin/matches/:id/unflag
   */
  unflagMatch: (id: string) =>
    apiFetch<{ message: string }>(`/admin/matches/${id}/unflag`, { method: 'POST' }),
};
