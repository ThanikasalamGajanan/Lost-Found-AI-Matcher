import { Router } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { query, queryOne } from '../db/pool.js';

export const adminRoutes = Router();

// All admin routes require authentication + admin role
adminRoutes.use(authenticate, requireAdmin);

// ────────────────────────────────────────────────
// GET /api/admin/stats
// Dashboard statistics.
// ────────────────────────────────────────────────
adminRoutes.get('/stats', asyncHandler(async (_req: AuthRequest, res) => {
  const [lostStats, foundStats, matchStats] = await Promise.all([
    queryOne<{ total: string; active: string }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active
      FROM lost_items`
    ),
    queryOne<{ total: string; active: string }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active
      FROM found_items`
    ),
    queryOne<{ total: string; pending: string; approved: string; disputed: string }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'disputed') AS disputed
      FROM matches`
    ),
  ]);

  res.json({
    lost_items: lostStats,
    found_items: foundStats,
    matches: matchStats,
  });
}));

// ────────────────────────────────────────────────
// GET /api/admin/matches
// All matches with pagination and status filter.
// ────────────────────────────────────────────────
adminRoutes.get('/matches', asyncHandler(async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params: unknown[] = [];

  if (status && ['pending', 'approved', 'rejected', 'disputed'].includes(status)) {
    params.push(status);
    whereClause = `WHERE m.status = $${params.length}`;
  }

  const matches = await query(
    `SELECT
      m.id, m.total_score, m.status, m.created_at,
      l.id AS lost_id, l.category AS lost_category, l.description AS lost_desc,
      f.id AS found_id, f.category AS found_category, f.description AS found_desc
    FROM matches m
    JOIN lost_items l ON l.id = m.lost_item_id
    JOIN found_items f ON f.id = m.found_item_id
    ${whereClause}
    ORDER BY m.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json({ page, limit, matches });
}));

// ────────────────────────────────────────────────
// POST /api/admin/matches/:id/approve
// ────────────────────────────────────────────────
adminRoutes.post('/matches/:id/approve', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const match = await queryOne('SELECT id FROM matches WHERE id = $1', [id]);
  if (!match) throw new AppError('Match not found', 404);

  await query(`UPDATE matches SET status = 'approved' WHERE id = $1`, [id]);
  await query(`UPDATE lost_items SET status = 'verified' WHERE id = (SELECT lost_item_id FROM matches WHERE id = $1)`, [id]);
  await query(`UPDATE found_items SET status = 'verified' WHERE id = (SELECT found_item_id FROM matches WHERE id = $1)`, [id]);

  res.json({ message: 'Match approved' });
}));

// ────────────────────────────────────────────────
// POST /api/admin/matches/:id/reject
// ────────────────────────────────────────────────
adminRoutes.post('/matches/:id/reject', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const match = await queryOne('SELECT id FROM matches WHERE id = $1', [id]);
  if (!match) throw new AppError('Match not found', 404);

  await query(`UPDATE matches SET status = 'rejected' WHERE id = $1`, [id]);

  res.json({ message: 'Match rejected' });
}));

// ────────────────────────────────────────────────
// PATCH /api/admin/items/:id/status
// Update an item's status (e.g. mark as "returned").
// ────────────────────────────────────────────────
adminRoutes.patch('/items/:id/status', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, type, reason } = req.body;

  if (!status || !type || !['lost', 'found'].includes(type)) {
    throw new AppError('Provide status and type (lost/found)', 400);
  }

  const table = type === 'lost' ? 'lost_items' : 'found_items';
  const validStatuses = ['active', 'matched', 'verified', 'returned', 'closed'];
  if (!validStatuses.includes(status)) {
    throw new AppError(`Status must be one of: ${validStatuses.join(', ')}`, 400);
  }

  const oldItem = await queryOne<{ status: string }>(
    `SELECT status FROM ${table} WHERE id = $1`,
    [id]
  );
  if (!oldItem) throw new AppError('Item not found', 404);

  await query(`UPDATE ${table} SET status = $1 WHERE id = $2`, [status, id]);

  // Audit log
  await query(
    `INSERT INTO item_status_log (item_id, item_type, old_status, new_status, changed_by, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, type, oldItem.status, status, req.userId, reason]
  );

  res.json({ message: `Item status updated to ${status}` });
}));
