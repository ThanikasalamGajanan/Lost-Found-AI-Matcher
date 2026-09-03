import { Router } from 'express';
import Joi from 'joi';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import { query, queryOne } from '../db/pool.js';
import { createNotification } from '../services/notificationService.js';

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
      m.id, m.total_score, m.status, m.fraud_flag, m.flag_reason,
      m.flagged_at, m.created_at,
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

  const match = await queryOne<{ lost_item_id: string; found_item_id: string }>(
    `SELECT id, lost_item_id, found_item_id FROM matches WHERE id = $1`,
    [id]
  );
  if (!match) throw new AppError('Match not found', 404);

  // Approve match and mark items verified
  await query(`UPDATE matches SET status = 'approved', fraud_flag = false WHERE id = $1`, [id]);
  await query(`UPDATE lost_items SET status = 'verified' WHERE id = $1`, [match.lost_item_id]);
  await query(`UPDATE found_items SET status = 'verified' WHERE id = $1`, [match.found_item_id]);

  // Fetch both parties
  const parties = await queryOne<{ claimant_id: string; finder_id: string }>(
    `SELECT l.user_id AS claimant_id, f.user_id AS finder_id
     FROM matches m
     JOIN lost_items l ON l.id = m.lost_item_id
     JOIN found_items f ON f.id = m.found_item_id
     WHERE m.id = $1`,
    [id]
  );

  if (parties) {
    await createNotification(
      parties.claimant_id, 'match_approved',
      'Match approved by admin',
      'An admin has reviewed and approved your match. You can now message the finder to arrange pickup.',
      undefined, undefined, id
    );
    await createNotification(
      parties.finder_id, 'match_approved',
      'Match approved by admin',
      'An admin has approved the match for your found item. A message thread is now open to arrange the handoff.',
      undefined, undefined, id
    );
  }

  res.json({ message: 'Match approved' });
}));

// ────────────────────────────────────────────────
// POST /api/admin/matches/:id/reject
// ────────────────────────────────────────────────
adminRoutes.post('/matches/:id/reject', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const match = await queryOne<{ lost_item_id: string; found_item_id: string }>(
    `SELECT id, lost_item_id, found_item_id FROM matches WHERE id = $1`,
    [id]
  );
  if (!match) throw new AppError('Match not found', 404);

  await query(`UPDATE matches SET status = 'rejected' WHERE id = $1`, [id]);

  // Reset items back to active so they can be re-matched
  await query(
    `UPDATE lost_items SET status = 'active' WHERE id = $1 AND status = 'matched'`,
    [match.lost_item_id]
  );
  await query(
    `UPDATE found_items SET status = 'active' WHERE id = $1 AND status = 'matched'`,
    [match.found_item_id]
  );

  // Notify both parties
  const parties = await queryOne<{ claimant_id: string; finder_id: string }>(
    `SELECT l.user_id AS claimant_id, f.user_id AS finder_id
     FROM matches m
     JOIN lost_items l ON l.id = m.lost_item_id
     JOIN found_items f ON f.id = m.found_item_id
     WHERE m.id = $1`,
    [id]
  );

  if (parties) {
    await createNotification(
      parties.claimant_id, 'match_rejected',
      'Match rejected by admin',
      'An admin has rejected the match for your lost item. You may receive other matches.',
      match.lost_item_id, 'lost', id
    );
    await createNotification(
      parties.finder_id, 'match_rejected',
      'Match rejected by admin',
      'An admin has rejected the match for your found item. You may receive other matches.',
      match.found_item_id, 'found', id
    );
  }

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

  const oldItem = await queryOne<{ status: string; user_id: string }>(
    `SELECT status, user_id FROM ${table} WHERE id = $1`,
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

  // Notify owner on returned or closed
  if (status === 'returned' || status === 'closed') {
    await createNotification(
      oldItem.user_id, 'item_returned',
      status === 'returned' ? 'Item marked as returned' : 'Item closed',
      status === 'returned'
        ? 'Your item has been marked as returned by an admin. Thank you for using the service!'
        : 'Your item listing has been closed by an admin.',
      id, type as 'lost' | 'found'
    );
  }

  res.json({ message: `Item status updated to ${status}` });
}));

// ────────────────────────────────────────────────
// GET /api/admin/disputed
// List matches that are disputed or fraud-flagged — includes
// verification attempts and question text for admin review.
// ────────────────────────────────────────────────
adminRoutes.get('/disputed', asyncHandler(async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  // Matches that are either disputed (auto-escalated) or manually flagged
  const matches = await query(
    `SELECT
       m.id, m.total_score, m.status, m.fraud_flag, m.flag_reason,
       m.flagged_at, m.created_at,
       l.id AS lost_id, l.category AS lost_category,
       l.description AS lost_desc, l.user_id AS claimant_id,
       f.id AS found_id, f.category AS found_category,
       f.description AS found_desc, f.user_id AS finder_id,
       cl.full_name AS claimant_name, cl.email AS claimant_email,
       fi.full_name AS finder_name,   fi.email AS finder_email
     FROM matches m
     JOIN lost_items  l ON l.id = m.lost_item_id
     JOIN found_items f ON f.id = m.found_item_id
     JOIN users cl ON cl.id = l.user_id
     JOIN users fi ON fi.id = f.user_id
     WHERE m.status = 'disputed' OR m.fraud_flag = true
     ORDER BY
       CASE WHEN m.fraud_flag = true THEN 0 ELSE 1 END,
       m.flagged_at DESC NULLS LAST,
       m.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  // Fetch verification attempts for each match
  if (matches.length > 0) {
    const matchIds = matches.map((m: Record<string, unknown>) => m.id);
    const placeholders = matchIds.map((_: unknown, i: number) => `$${i + 1}`).join(',');

    const [questions, attempts] = await Promise.all([
      query(
        `SELECT id, match_id, question_text, correct_answer, field_source
         FROM verification_questions
         WHERE match_id IN (${placeholders})`,
        matchIds
      ),
      query(
        `SELECT id, match_id, attempt_number, answer_text, is_correct, judged_at
         FROM verification_attempts
         WHERE match_id IN (${placeholders})
         ORDER BY attempt_number ASC`,
        matchIds
      ),
    ]);

    // Attach verification history to each match
    for (const m of matches as Record<string, unknown>[]) {
      m.questions = questions.filter(
        (q: Record<string, unknown>) => q.match_id === m.id
      );
      m.attempts = attempts.filter(
        (a: Record<string, unknown>) => a.match_id === m.id
      );
    }
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM matches WHERE status = 'disputed' OR fraud_flag = true`
  );

  res.json({
    page,
    limit,
    total: parseInt(countResult?.count || '0', 10),
    matches,
  });
}));

// ────────────────────────────────────────────────
// POST /api/admin/matches/:id/flag
// Manually flag a match as fraudulent with a reason.
// ────────────────────────────────────────────────
const flagSchema = Joi.object({
  reason: Joi.string().min(1).max(1000).required(),
});

adminRoutes.post(
  '/matches/:id/flag',
  validateBody(flagSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const match = await queryOne<{ id: string }>(
      `SELECT id FROM matches WHERE id = $1`,
      [id]
    );
    if (!match) throw new AppError('Match not found', 404);

    await query(
      `UPDATE matches
       SET fraud_flag = true, flag_reason = $2, flagged_at = now(),
           status = CASE WHEN status = 'approved' THEN status ELSE 'disputed' END
       WHERE id = $1`,
      [id, reason]
    );

    // Notify both parties that the case is under review
    const parties = await queryOne<{ claimant_id: string; finder_id: string }>(
      `SELECT l.user_id AS claimant_id, f.user_id AS finder_id
       FROM matches m
       JOIN lost_items l ON l.id = m.lost_item_id
       JOIN found_items f ON f.id = m.found_item_id
       WHERE m.id = $1`,
      [id]
    );

    if (parties) {
      await createNotification(
        parties.claimant_id, 'admin_message',
        'Match under review',
        'Your match has been flagged for admin review. Please wait while we investigate.',
        undefined, undefined, id
      );
      await createNotification(
        parties.finder_id, 'admin_message',
        'Match under review',
        'Your match has been flagged for admin review. Please wait while we investigate.',
        undefined, undefined, id
      );
    }

    res.json({ message: 'Match flagged for review' });
  })
);

// ────────────────────────────────────────────────
// POST /api/admin/matches/:id/unflag
// Remove the fraud flag from a match.
// ────────────────────────────────────────────────
adminRoutes.post('/matches/:id/unflag', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const match = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM matches WHERE id = $1`,
    [id]
  );
  if (!match) throw new AppError('Match not found', 404);

  await query(
    `UPDATE matches
     SET fraud_flag = false, flag_reason = NULL, flagged_at = NULL
     WHERE id = $1`,
    [id]
  );

  res.json({ message: 'Match flag removed' });
}));
