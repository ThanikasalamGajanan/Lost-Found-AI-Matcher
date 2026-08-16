import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

/**
 * Supabase client using the service role key (bypasses RLS).
 * Use this for server-side operations only.
 */
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

/**
 * Supabase client using the anon key (respects RLS).
 * Suitable for operations that should be scoped to the authenticated user.
 */
export const supabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey
);
