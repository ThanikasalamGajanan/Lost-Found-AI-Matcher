import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validateBody, verificationAnswerSchema, verificationJudgeSchema } from '../middleware/validate.js';
import { query, queryOne } from '../db/pool.js';
import { generateVerificationQuestion, verifyAnswer } from '../services/verificationService.js';
import { createNotification } from '../services/notificationService.js';
import { config } from '../config/index.js';

export const verifyRoutes = Router();

verifyRoutes.use(authenticate);

// ────────────────────────────────────────────────
// GET /api/verify/:matchId/question
// Retrieve or generate a verification question for a match.
// On retry, a *different* question is generated (excludes
// field_sources used in previous questions).
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

  // Look for an existing unanswered question
  // (a question is "unanswered" if no attempt references it yet)
  let question = await queryOne(
    `SELECT vq.id, vq.question_text
     FROM verification_questions vq
     LEFT JOIN verification_attempts va ON va.question_id = vq.id
     WHERE vq.match_id = $1 AND va.id IS NULL
     ORDER BY vq.created_at DESC
     LIMIT 1`,
    [matchId]
  );

  // Generate a new question if none is pending
  if (!question) {
    const privateDetails = (m.private_details as Record<string, string>) || {};
    if (Object.keys(privateDetails).length === 0) {
      throw new AppError('No private details available to generate a verification question', 400);
    }

    // Exclude field_sources already used so retries get a different question
    const usedFields = await query<{ field_source: string }>(
      `SELECT field_source FROM verification_questions WHERE match_id = $1`,
      [matchId]
    );
    const usedFieldKeys = new Set(usedFields.map((r) => r.field_source));

    question = await generateVerificationQuestion(matchId, privateDetails, usedFieldKeys);
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
// The claimant submits an answer. The system auto-verifies it
// using LLM fuzzy comparison (verifyAnswer). Outcomes:
//   • correct       → approve match, unlock contact info
//   • incorrect     → if retries remain, generate a NEW question;
//                     otherwise escalate to admin
// ────────────────────────────────────────────────
verifyRoutes.post(
  '/:matchId/answer',
  validateBody(verificationAnswerSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { matchId } = req.params;
    const { answer } = req.body;

    // Get the latest unanswered question for this match
    const question = await queryOne<{
      id: string;
      match_id: string;
      correct_answer: string;
    }>(
      `SELECT vq.id, vq.match_id, vq.correct_answer
       FROM verification_questions vq
       LEFT JOIN verification_attempts va ON va.question_id = vq.id
       WHERE vq.match_id = $1 AND va.id IS NULL
       ORDER BY vq.created_at DESC
       LIMIT 1`,
      [matchId]
    );

    if (!question) {
      throw new AppError('No pending verification question for this match', 404);
    }

    // Count previous attempts to enforce retry limit
    const attemptCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM verification_attempts WHERE match_id = $1`,
      [matchId]
    );
    const attemptNumber = parseInt(attemptCount?.count || '0', 10) + 1;

    if (attemptNumber > config.matching.maxRetries) {
      await query(`UPDATE matches SET status = 'disputed' WHERE id = $1`, [matchId]);
      throw new AppError('Maximum attempts reached. This case has been escalated to an admin.', 429);
    }

    // ── Auto-verify the answer using LLM fuzzy comparison ──
    const isCorrect = await verifyAnswer(answer, question.correct_answer);

    // Store the attempt with the auto-judgment (judged_by = NULL for system)
    const attempt = await queryOne<{
      id: string;
      attempt_number: number;
      is_correct: boolean;
    }>(
      `INSERT INTO verification_attempts
         (question_id, match_id, claimant_id, answer_text,
          is_correct, judged_by, judged_at, attempt_number)
       VALUES ($1, $2, $3, $4, $5, NULL, now(), $6)
       RETURNING id, attempt_number, is_correct`,
      [question.id, matchId, req.userId, answer, isCorrect, attemptNumber]
    );

    // Fetch both parties' user IDs for notifications
    const parties = await queryOne<{ claimant_id: string; finder_id: string }>(
      `SELECT l.user_id AS claimant_id, f.user_id AS finder_id
       FROM matches m
       JOIN lost_items l ON l.id = m.lost_item_id
       JOIN found_items f ON f.id = m.found_item_id
       WHERE m.id = $1`,
      [matchId]
    );

    if (isCorrect) {
      // ── CORRECT → approve match, unlock contact info ──
      await query(`UPDATE matches SET status = 'approved' WHERE id = $1`, [matchId]);
      await query(
        `UPDATE lost_items SET status = 'verified'
         WHERE id = (SELECT lost_item_id FROM matches WHERE id = $1)`,
        [matchId]
      );
      await query(
        `UPDATE found_items SET status = 'verified'
         WHERE id = (SELECT found_item_id FROM matches WHERE id = $1)`,
        [matchId]
      );

      if (parties) {
        await createNotification(
          parties.claimant_id, 'match_approved',
          'Verification passed!',
          'Your answer was correct. You can now message the finder to arrange pickup.',
          undefined, undefined, matchId
        );
        await createNotification(
          parties.finder_id, 'verification_result',
          'Claimant verified',
          'The claimant answered correctly. A message thread is now open for you to arrange the handoff.',
          undefined, undefined, matchId
        );
      }

      res.status(201).json({
        attempt_id: attempt!.id,
        attempt_number: attempt!.attempt_number,
        result: 'correct',
        message: 'Verification passed. A message thread is now open to arrange the handoff.',
      });
      return;
    }

    // ── INCORRECT ──
    const retriesRemaining = config.matching.maxRetries - attemptNumber;

    if (retriesRemaining <= 0) {
      // No retries left → escalate to admin
      await query(`UPDATE matches SET status = 'disputed' WHERE id = $1`, [matchId]);

      if (parties) {
        await createNotification(
          parties.claimant_id, 'match_rejected',
          'Verification failed',
          'Your answer was incorrect and no retries remain. This case has been escalated to an admin.',
          undefined, undefined, matchId
        );
        await createNotification(
          parties.finder_id, 'admin_message',
          'Match escalated to admin',
          'A verification attempt failed and has been escalated for admin review.',
          undefined, undefined, matchId
        );
      }

      res.status(201).json({
        attempt_id: attempt!.id,
        attempt_number: attempt!.attempt_number,
        result: 'escalated',
        message: 'Incorrect answer. Maximum attempts reached — escalated to admin.',
        retries_remaining: 0,
      });
      return;
    }

    // ── Retries remain → generate a DIFFERENT question for the next attempt ──
    await query(`UPDATE matches SET status = 'pending' WHERE id = $1`, [matchId]);

    const foundItem = await queryOne<{ private_details: Record<string, string> }>(
      `SELECT f.private_details
       FROM matches m
       JOIN found_items f ON f.id = m.found_item_id
       WHERE m.id = $1`,
      [matchId]
    );
    const privateDetails = (foundItem?.private_details as Record<string, string>) || {};
    let newQuestion: { id: string; question_text: string } | null = null;

    if (Object.keys(privateDetails).length > 0) {
      const usedFields = await query<{ field_source: string }>(
        `SELECT field_source FROM verification_questions WHERE match_id = $1`,
        [matchId]
      );
      const usedFieldKeys = new Set(usedFields.map((r) => r.field_source));

      try {
        newQuestion = await generateVerificationQuestion(matchId, privateDetails, usedFieldKeys);
      } catch {
        // Non-fatal: claimant can re-request a question via GET /question
      }
    }

    if (parties) {
      await createNotification(
        parties.claimant_id, 'verification_question',
        'Incorrect answer — retry available',
        `Your answer was incorrect. You have ${retriesRemaining} attempt(s) remaining. A new question has been generated.`,
        undefined, undefined, matchId
      );
      await createNotification(
        parties.finder_id, 'verification_result',
        'Verification answer incorrect',
        `The claimant's answer was incorrect. ${retriesRemaining} retry attempt(s) remaining.`,
        undefined, undefined, matchId
      );
    }

    res.status(201).json({
      attempt_id: attempt!.id,
      attempt_number: attempt!.attempt_number,
      result: 'incorrect',
      retries_remaining: retriesRemaining,
      message: `Incorrect. ${retriesRemaining} attempt(s) remaining.`,
      new_question: newQuestion
        ? { question_id: newQuestion.id, question_text: newQuestion.question_text }
        : null,
    });
  })
);

// ────────────────────────────────────────────────
// POST /api/verify/:matchId/judge
// Finder override endpoint. The finder can override the system's
// auto-judgment on any attempt:
//   • Mark system-rejected answer as correct  → approve match
//   • Mark system-approved answer as incorrect → revert & possibly retry
// ────────────────────────────────────────────────
verifyRoutes.post(
  '/:matchId/judge',
  validateBody(verificationJudgeSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { matchId } = req.params;
    const { is_correct, attempt_id } = req.body;

    // Verify the requester is the finder (or admin)
    const match = await queryOne<{
      finder_id: string;
      claimant_id: string;
    }>(
      `SELECT f.user_id AS finder_id, l.user_id AS claimant_id
       FROM matches m
       JOIN found_items f ON f.id = m.found_item_id
       JOIN lost_items l ON l.id = m.lost_item_id
       WHERE m.id = $1`,
      [matchId]
    );

    if (!match) {
      throw new AppError('Match not found', 404);
    }
    if (match.finder_id !== req.userId && req.userRole !== 'admin') {
      throw new AppError('Only the finder can override verification', 403);
    }

    // Verify the attempt exists
    const attempt = await queryOne<{ attempt_number: number }>(
      `SELECT attempt_number FROM verification_attempts WHERE id = $1`,
      [attempt_id]
    );
    if (!attempt) {
      throw new AppError('Attempt not found', 404);
    }

    // Update the attempt with the finder's judgment
    await query(
      `UPDATE verification_attempts SET is_correct = $1, judged_by = $2, judged_at = now() WHERE id = $3`,
      [is_correct, req.userId, attempt_id]
    );

    if (is_correct) {
      // ── Finder marks CORRECT → approve match ──
      await query(`UPDATE matches SET status = 'approved' WHERE id = $1`, [matchId]);
      await query(
        `UPDATE lost_items SET status = 'verified'
         WHERE id = (SELECT lost_item_id FROM matches WHERE id = $1)`,
        [matchId]
      );
      await query(
        `UPDATE found_items SET status = 'verified'
         WHERE id = (SELECT found_item_id FROM matches WHERE id = $1)`,
        [matchId]
      );

      await createNotification(
        match.claimant_id, 'match_approved',
        'Verification approved',
        'The finder has approved your verification. A message thread is now open to arrange the handoff.',
        undefined, undefined, matchId
      );

      res.json({
        result: 'correct',
        message: 'Finder confirmed correct. A message thread is now open to arrange the handoff.',
      });
      return;
    }

    // ── Finder marks INCORRECT ──
    const attempts = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM verification_attempts WHERE match_id = $1`,
      [matchId]
    );
    const usedAttempts = parseInt(attempts?.count || '1', 10);
    const retriesRemaining = config.matching.maxRetries - usedAttempts;

    if (retriesRemaining <= 0) {
      // No retries left → escalate
      await query(`UPDATE matches SET status = 'disputed' WHERE id = $1`, [matchId]);

      await createNotification(
        match.claimant_id, 'match_rejected',
        'Verification failed',
        'The finder marked your answer as incorrect. This case has been escalated to an admin.',
        undefined, undefined, matchId
      );

      res.json({
        result: 'escalated',
        message: 'Finder marked incorrect. No retries remaining — escalated to admin.',
        retries_remaining: 0,
      });
      return;
    }

    // Retries remain → generate a different question
    await query(`UPDATE matches SET status = 'pending' WHERE id = $1`, [matchId]);

    const foundItem = await queryOne<{ private_details: Record<string, string> }>(
      `SELECT f.private_details
       FROM matches m
       JOIN found_items f ON f.id = m.found_item_id
       WHERE m.id = $1`,
      [matchId]
    );
    const privateDetails = (foundItem?.private_details as Record<string, string>) || {};
    let newQuestion: { id: string; question_text: string } | null = null;

    if (Object.keys(privateDetails).length > 0) {
      const usedFields = await query<{ field_source: string }>(
        `SELECT field_source FROM verification_questions WHERE match_id = $1`,
        [matchId]
      );
      const usedFieldKeys = new Set(usedFields.map((r) => r.field_source));

      try {
        newQuestion = await generateVerificationQuestion(matchId, privateDetails, usedFieldKeys);
      } catch {
        // Non-fatal
      }
    }

    await createNotification(
      match.claimant_id, 'verification_question',
      'Answer marked incorrect — retry available',
      `The finder marked your answer as incorrect. You have ${retriesRemaining} attempt(s) remaining with a new question.`,
      undefined, undefined, matchId
    );

    res.json({
      result: 'incorrect',
      retries_remaining: retriesRemaining,
      message: `Finder marked incorrect. ${retriesRemaining} attempt(s) remaining.`,
      new_question: newQuestion
        ? { question_id: newQuestion.id, question_text: newQuestion.question_text }
        : null,
    });
  })
);
