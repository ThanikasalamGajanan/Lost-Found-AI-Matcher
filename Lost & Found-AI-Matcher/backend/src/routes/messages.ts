import { Router } from 'express';
import Joi from 'joi';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import { query, queryOne } from '../db/pool.js';
import { createNotification } from '../services/notificationService.js';

export const messageRoutes = Router();

messageRoutes.use(authenticate);

// ── Shared validation ──────────────────────────
const sendMessageSchema = Joi.object({
  body: Joi.string().min(1).max(2000).required(),
});

// ── Helper ────────────────────────────────────
/**
 * Verify that the requester is a participant of an **approved** match.
 * Returns the other party's user ID (for notifications).
 */
async function assertMatchParticipant(
  matchId: string,
  userId: string,
  userRole?: string
): Promise<{ otherPartyId: string }> {
  const match = await queryOne<{
    status: string;
    claimant_id: string;
    finder_id: string;
  }>(
    `SELECT m.status,
            l.user_id AS claimant_id,
            f.user_id AS finder_id
     FROM matches m
     JOIN lost_items  l ON l.id = m.lost_item_id
     JOIN found_items f ON f.id = m.found_item_id
     WHERE m.id = $1`,
    [matchId]
  );

  if (!match) {
    throw new AppError('Match not found', 404);
  }

  if (match.status !== 'approved' && userRole !== 'admin') {
    throw new AppError(
      'Messaging is only available after verification is approved',
      403
    );
  }

  const isParticipant =
    match.claimant_id === userId || match.finder_id === userId;
  if (!isParticipant && userRole !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  const otherPartyId =
    userId === match.claimant_id ? match.finder_id : match.claimant_id;

  return { otherPartyId };
}

// ────────────────────────────────────────────────
// GET /api/messages/:matchId
// Fetch the full message thread for a match, oldest first.
// Only accessible to the two match participants.
// ────────────────────────────────────────────────
messageRoutes.get('/:matchId', asyncHandler(async (req: AuthRequest, res) => {
  const { matchId } = req.params;

  await assertMatchParticipant(matchId, req.userId!, req.userRole);

  const messages = await query(
    `SELECT msg.id,
            msg.sender_id,
            u.full_name AS sender_name,
            msg.body,
            msg.created_at
     FROM messages msg
     JOIN users u ON u.id = msg.sender_id
     WHERE msg.match_id = $1
     ORDER BY msg.created_at ASC`,
    [matchId]
  );

  res.json({ messages });
}));

// ────────────────────────────────────────────────
// POST /api/messages/:matchId
// Send a message in the match thread.
// Only accessible after the match status is 'approved'.
// ────────────────────────────────────────────────
messageRoutes.post(
  '/:matchId',
  validateBody(sendMessageSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { matchId } = req.params;
    const { body } = req.body;

    const { otherPartyId } = await assertMatchParticipant(
      matchId,
      req.userId!,
      req.userRole
    );

    const message = await queryOne<{
      id: string;
      sender_id: string;
      body: string;
      created_at: string;
    }>(
      `INSERT INTO messages (match_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, body, created_at`,
      [matchId, req.userId, body]
    );

    // Notify the other party
    await createNotification(
      otherPartyId,
      'admin_message',           // reuse generic type (could add 'new_message' later)
      'New message',
      'You have a new message about your match.',
      undefined,
      undefined,
      matchId
    );

    res.status(201).json(message);
  })
);
