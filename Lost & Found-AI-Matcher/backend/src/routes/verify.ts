import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validateBody, verificationAnswerSchema, verificationJudgeSchema } from '../middleware/validate.js';
import { query, queryOne } from '../db/pool.js';
import { generateVerificationQuestion } from '../services/verificationService.js';
import { config } from '../config/index.js';

export const verifyRoutes = Router();

verifyRoutes.use(authenticate);

// ────────────────────────────────────────────────
// GET /api/verify/:matchId/question
// Generate or retrieve the verification question for a match.
// ────────────────────────────────────────────────
verifyRoutes.get('/:matchId/question', asyncHandler(async (req: AuthRequest, res) => {
  const { matchId } = req.params;

  // Fetch the match + found item's private details
  const match = await queryOne(
    `SELECT m.*, f.private_details, f.user_id AS finder_id, l.user_id AS claimant_id
     FROM matches m
     JOIN found_items f ON f.id = m.found_item_id
     JOIN lost_items l ON l.id = m.lost_item_id
     WHERE m.id = $1`,
    [matchId]
  );

  if (!match) {
    throw new AppError('Match not found', 404);
  }

  const m = match as Record<string, unknown>;

  // Only the claimant (lost-item owner) or admin can request the question
  if (m.claimant_id !== req.userId && req.userRole !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  // Check if a question already exists
  let question = await queryOne(
    `SELECT id, question_text FROM verification_questions WHERE match_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [matchId]
  );

  // Generate a new question if none exists
  if (!question) {
    const privateDetails = (m.private_details as Record<string, string>) || {};
    if (Object.keys(privateDetails).length === 0) {
      throw new AppError('No private details available to generate a verification question', 400);
    }

    question = await generateVerificationQuestion(matchId, privateDetails);
  }

  // Return only the question text (never the answer!)
  const q = question as Record<string, unknown>;
  res.json({
    question_id: q.id,
    question_text: q.question_text,
  });
}));

// ────────────────────────────────────────────────
// POST /api/verify/:matchId/answer
// The lost-item owner submits their answer to the verification question.
// ────────────────────────────────────────────────
verifyRoutes.post(
  '/:matchId/answer',
  validateBody(verificationAnswerSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { matchId } = req.params;
    const { answer } = req.body;

    // Get the latest question for this match
    const question = await queryOne<{ id: string; match_id: string }>(
      `SELECT id FROM verification_questions WHERE match_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [matchId]
    );

    if (!question) {
      throw new AppError('No verification question found for this match', 404);
    }

    // Count previous attempts
    const attemptCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM verification_attempts WHERE match_id = $1`,
      [matchId]
    );

    const attemptNumber = parseInt(attemptCount?.count || '0', 10) + 1;
    if (attemptNumber > config.matching.maxRetries) {
      // Escalate to admin
      await query(
        `UPDATE matches SET status = 'disputed' WHERE id = $1`,
        [matchId]
      );
      throw new AppError('Maximum retries exceeded. This match has been escalated to an admin.', 429);
    }

    const attempt = await queryOne(
      `INSERT INTO verification_attempts (question_id, match_id, claimant_id, answer_text, attempt_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, attempt_number, created_at`,
      [question.id, matchId, req.userId, answer, attemptNumber]
    );

    // Update match status
    await query(
      `UPDATE matches SET status = 'pending' WHERE id = $1`,
      [matchId]
    );

    res.status(201).json(attempt);
  })
);

// ────────────────────────────────────────────────
// POST /api/verify/:matchId/judge
// The finder judges the answer as correct or incorrect.
// ────────────────────────────────────────────────
verifyRoutes.post(
  '/:matchId/judge',
  validateBody(verificationJudgeSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { matchId } = req.params;
    const { is_correct, attempt_id } = req.body;

    // Verify the requester is the finder
    const match = await queryOne<{ finder_id: string }>(
      `SELECT f.user_id AS finder_id
       FROM matches m
       JOIN found_items f ON f.id = m.found_item_id
       WHERE m.id = $1`,
      [matchId]
    );

    if (!match || match.finder_id !== req.userId) {
      throw new AppError('Only the finder can judge verification answers', 403);
    }

    // Update the attempt
    await query(
      `UPDATE verification_attempts SET is_correct = $1, judged_by = $2, judged_at = now() WHERE id = $3`,
      [is_correct, req.userId, attempt_id]
    );

    if (is_correct) {
      // Unlock contact info: mark match as approved
      await query(`UPDATE matches SET status = 'approved' WHERE id = $1`, [matchId]);
      await query(`UPDATE lost_items SET status = 'verified' WHERE id = (SELECT lost_item_id FROM matches WHERE id = $1)`, [matchId]);
      await query(`UPDATE found_items SET status = 'verified' WHERE id = (SELECT found_item_id FROM matches WHERE id = $1)`, [matchId]);

      res.json({ result: 'correct', message: 'Verification passed. Contact information is now available.' });
    } else {
      // Check remaining retries
      const attempts = await queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM verification_attempts WHERE match_id = $1`,
        [matchId]
      );
      const usedAttempts = parseInt(attempts?.count || '1', 10);
      const remaining = config.matching.maxRetries - usedAttempts;

      if (remaining <= 0) {
        await query(`UPDATE matches SET status = 'disputed' WHERE id = $1`, [matchId]);
        res.json({ result: 'escalated', message: 'Maximum retries exceeded. Escalated to admin.' });
      } else {
        await query(`UPDATE matches SET status = 'pending' WHERE id = $1`, [matchId]);
        res.json({ result: 'incorrect', remaining_attempts: remaining, message: `Incorrect. ${remaining} attempt(s) remaining.` });
      }
    }
  })
);
