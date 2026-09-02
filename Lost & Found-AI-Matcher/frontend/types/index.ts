// ─── Core Entities ─────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: 'user' | 'admin';
  preferred_lang: 'en' | 'ta' | 'si';
  created_at: string;
}

export interface LostItem {
  id: string;
  user_id: string;
  category: string;
  brand?: string;
  colour?: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  lost_at: string;
  reported_at: string;
  photo_url?: string;
  identifying_info?: string;
  status: ItemStatus;
  created_at: string;
}

export interface FoundItem {
  id: string;
  user_id: string;
  category: string;
  brand?: string;
  colour?: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  found_at: string;
  reported_at: string;
  photo_url?: string;
  private_details?: Record<string, string>;
  status: ItemStatus;
  created_at: string;
}

export type ItemStatus = 'active' | 'matched' | 'verified' | 'returned' | 'closed';

export interface Match {
  id: string;
  lost_item_id: string;
  found_item_id: string;
  total_score: number;
  desc_score: number;
  image_score: number;
  location_score: number;
  time_score: number;
  attr_score: number;
  status: MatchStatus;
  created_at: string;

  // Joined fields from API
  found_category?: string;
  found_brand?: string;
  found_colour?: string;
  found_description?: string;
  found_location?: string;
  found_photo_url?: string;
  lost_category?: string;
  lost_brand?: string;
  lost_colour?: string;
  lost_description?: string;
  lost_location?: string;
  lost_photo_url?: string;
}

export type MatchStatus = 'pending' | 'approved' | 'rejected' | 'disputed';

export interface VerificationQuestion {
  question_id: string;
  question_text: string;
}

export interface VerificationAttempt {
  id: string;
  attempt_number: number;
  answer_text: string;
  is_correct?: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  match_id?: string;
  item_id?: string;
  item_type?: 'lost' | 'found';
  is_read: boolean;
  created_at: string;
}

export type NotificationType =
  | 'new_match'
  | 'verification_question'
  | 'verification_result'
  | 'match_approved'
  | 'match_rejected'
  | 'item_returned'
  | 'admin_message';

// ─── Form Types ────────────────────────────────

export interface LostReportForm {
  category: string;
  brand: string;
  colour: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  lost_at: string;
  photo_url: string;
  identifying_info: string;
}

export interface FoundReportForm {
  category: string;
  brand: string;
  colour: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  found_at: string;
  photo_url: string;
  private_details: Record<string, string>;
}

// ─── Constants ─────────────────────────────────

export const CATEGORIES = [
  'keys',
  'electronics',
  'bag',
  'wallet',
  'jewellery',
  'clothing',
  'document',
  'umbrella',
  'bottle',
  'glasses',
  'other',
] as const;

export const COLOURS = [
  'black',
  'white',
  'red',
  'blue',
  'green',
  'yellow',
  'brown',
  'grey',
  'silver',
  'gold',
  'pink',
  'purple',
  'orange',
  'other',
] as const;

export const BRANDS = [
  'Apple',
  'Samsung',
  'Sony',
  'Nike',
  'Adidas',
  'Gucci',
  'Louis Vuitton',
  'Other',
] as const;
