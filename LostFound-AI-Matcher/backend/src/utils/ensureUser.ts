import { queryOne } from '../db/pool.js';
import { supabaseAdmin } from '../db/supabase.js';

/**
 * Ensure a row exists in the public.users table for the given user ID.
 *
 * In production Supabase, the auth trigger usually creates this row.
 * In local development (no auth.users table), signups may leave the row
 * missing, which breaks foreign keys and notifications for that user.
 *
 * This helper backfills the row using Supabase Auth when possible, or a
 * placeholder record as a last resort so the rest of the flow can continue.
 */
export async function ensureUserExists(
  userId: string,
  fallbackEmail?: string,
  fallbackName?: string
): Promise<void> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE id = $1`,
    [userId]
  );
  if (existing) return;

  let email = fallbackEmail || `${userId}@local.dev`;
  let fullName = fallbackName || 'User';

  // Try Supabase Auth (works in cloud; fails gracefully in local dev).
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (data?.user && !error) {
      email = data.user.email || email;
      fullName =
        (data.user.user_metadata?.full_name as string | undefined) ||
        (data.user.user_metadata?.name as string | undefined) ||
        fullName;
    }
  } catch {
    // Ignore: local dev has no auth.users table.
  }

  await queryOne(
    `INSERT INTO users (id, email, full_name, role, preferred_lang)
     VALUES ($1, $2, $3, 'user', 'en')
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [userId, email, fullName]
  );
}
