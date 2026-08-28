import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { query, queryOne } from '../db/pool.js';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

// ────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// Mark all notifications as read (MUST be before /:id routes).
// ────────────────────────────────────────────────
notificationRoutes.patch('/read-all', asyncHandler(async (req: AuthRequest, res) => {
  await query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [req.userId]
  );

  res.json({ message: 'All notifications marked as read' });
}));

// ────────────────────────────────────────────────
// GET /api/notifications
// Get the authenticated user's notifications, newest first.
// ────────────────────────────────────────────────
notificationRoutes.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const unreadOnly = req.query.unread === 'true';

  const whereClause = unreadOnly ? 'AND is_read = false' : '';

  const notifications = await query(
    `SELECT id, type, title, message, match_id, item_id, item_type,
            is_read, created_at
     FROM notifications
     WHERE user_id = $1 ${whereClause}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.userId, limit, offset]
  );

  const unreadCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [req.userId]
  );

  res.json({
    notifications,
    unread_count: parseInt(unreadCount?.count || '0', 10),
    page,
    limit,
  });
}));

// ────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
// Mark a single notification as read.
// ────────────────────────────────────────────────
notificationRoutes.patch('/:id/read', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  await query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );

  res.json({ message: 'Notification marked as read' });
}));

