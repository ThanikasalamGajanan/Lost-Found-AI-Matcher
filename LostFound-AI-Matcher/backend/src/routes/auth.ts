import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { supabaseAdmin } from '../db/supabase.js';
import { queryOne } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRoutes = Router();

/**
 * POST /api/auth/signup
 * Create a new Supabase Auth user. The DB trigger auto-creates a `users` row.
 */
authRoutes.post('/signup', asyncHandler(async (req, res) => {
  const { email, password, full_name } = req.body;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error || !data.user) {
    throw new AppError(error?.message || 'Signup failed', 400);
  }

  console.log(`[AUTH] Signup succeeded for ${email} -> user ${data.user.id}`);

  // Create local user row (needed when using local PostgreSQL instead of Supabase DB)
  try {
    await queryOne(
      `INSERT INTO users (id, email, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name
       RETURNING id`,
      [data.user.id, email, full_name || email.split('@')[0]]
    );
  } catch (dbErr) {
    console.warn('Failed to mirror user to local DB:', (dbErr as Error).message);
  }

  // Issue our own JWT for backend API auth
  const token = jwt.sign(
    { sub: data.user.id, role: 'user', email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.status(201).json({
    user: { id: data.user.id, email, full_name },
    token,
  });
}));/**
 * POST /api/auth/login
 * Authenticate with email + password.
 */
authRoutes.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new AppError('Invalid email or password', 401);
  }

  console.log(`[AUTH] Login succeeded for ${email} -> user ${data.user.id}`);

  // Fetch role from our users table. Fall back to the Supabase REST API when the
  // PostgreSQL pool is unreachable (e.g. bad DATABASE_URL on Render) — the users
  // row is auto-created by the auth.users trigger in the cloud DB, so Supabase
  // Auth already succeeded and login should not fail because of the pool.
  let role = 'user';
  try {
    const userRow = await queryOne<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [data.user.id]
    );
    role = userRow?.role || 'user';
  } catch (dbErr) {
    console.warn(
      'users role lookup failed, falling back to Supabase REST:',
      (dbErr as Error).message
    );
    const { data: row } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();
    role = row?.role || 'user';
  }

  const token = jwt.sign(
    { sub: data.user.id, role, email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.json({
    user: { id: data.user.id, email, role },
    token,
  });
}));

/**
 * GET /api/auth/me
 * Get the current user's profile.
 */
authRoutes.get('/me', asyncHandler(async (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  const token = authHeader.split(' ')[1];
  let decoded: { sub: string };
  try {
    decoded = jwt.verify(token, config.jwt.secret) as { sub: string };
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  // Load the profile from PostgreSQL, falling back to the Supabase REST API
  // when the pool is unreachable so the dashboard still renders.
  let user: Record<string, unknown> | null = null;
  try {
    user = await queryOne(
      'SELECT id, email, full_name, phone, avatar_url, role, preferred_lang, created_at FROM users WHERE id = $1',
      [decoded.sub]
    );
  } catch (dbErr) {
    console.warn(
      'users profile lookup failed, falling back to Supabase REST:',
      (dbErr as Error).message
    );
    const { data: row } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, avatar_url, role, preferred_lang, created_at')
      .eq('id', decoded.sub)
      .single();
    user = row ?? null;
  }

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json(user);
}));
