import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { query, queryOne } from '../db/pool.js';
import { runMatchingEngine } from '../services/matchingEngine.js';

export const matchRoutes = Router();

matchRoutes.use(authenticate);

// ────────────────────────────────────────────────
// POST /api/matches/run/:reportId
// Trigger the matching engine for a specific lost or found report.
// ────────────────────────────────────────────────
matchRoutes.post('/run/:reportId', asyncHandler(async (req: AuthRequest, res) => {
  const { reportId } = req.params;
  const { type } = req.query as { type?: 'lost' | 'found' };

  if (!type || !['lost', 'found'].includes(type)) {
    throw new AppError('Query param "type" must be "lost" or "found"', 400);
  }

  // Verify the user owns this report
  const table = type === 'lost' ? 'lost_items' : 'found_items';
  const item = await queryOne(
    `SELECT id, user_id FROM ${table} WHERE id = $1`,
    [reportId]
  );

  if (!item) {
    throw new AppError('Report not found', 404);
  }

  if ((item as Record<string, unknown>).user_id !== req.userId && req.userRole !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  const matches = await runMatchingEngine(reportId, type);

  res.json({
    report_id: reportId,
    match_count: matches.length,
    matches,
  });
}));

// ────────────────────────────────────────────────
// GET /api/matches/:reportId
// Get all existing matches for a report, sorted by score descending.
// ────────────────────────────────────────────────
matchRoutes.get('/:reportId', asyncHandler(async (req: AuthRequest, res) => {
  const { reportId } = req.params;
  const { type } = req.query as { type?: 'lost' | 'found' };

  if (!type || !['lost', 'found'].includes(type)) {
    throw new AppError('Query param "type" must be "lost" or "found"', 400);
  }

  let matches;

  if (type === 'lost') {
    matches = await query(
      `SELECT
        m.id, m.total_score, m.desc_score, m.image_score,
        m.location_score, m.time_score, m.attr_score, m.status,
        m.created_at,
        f.id AS found_id, f.category AS found_category,
        f.brand AS found_brand, f.colour AS found_colour,
        f.description AS found_description, f.location AS found_location,
        f.photo_url AS found_photo_url, f.found_at
      FROM matches m
      JOIN found_items f ON f.id = m.found_item_id
      WHERE m.lost_item_id = $1
      ORDER BY m.total_score DESC`,
      [reportId]
    );
  } else {
    matches = await query(
      `SELECT
        m.id, m.total_score, m.desc_score, m.image_score,
        m.location_score, m.time_score, m.attr_score, m.status,
        m.created_at,
        l.id AS lost_id, l.category AS lost_category,
        l.brand AS lost_brand, l.colour AS lost_colour,
        l.description AS lost_description, l.location AS lost_location,
        l.photo_url AS lost_photo_url, l.lost_at
      FROM matches m
      JOIN lost_items l ON l.id = m.lost_item_id
      WHERE m.found_item_id = $1
      ORDER BY m.total_score DESC`,
      [reportId]
    );
  }

  res.json(matches);
}));
