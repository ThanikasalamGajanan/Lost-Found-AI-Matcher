import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validateBody, lostReportSchema, foundReportSchema } from '../middleware/validate.js';
import { query, queryOne } from '../db/pool.js';
import { generateEmbedding, extractStructuredFields } from '../services/llmService.js';
import { runMatchingEngine } from '../services/matchingEngine.js';

export const reportRoutes = Router();

// All report routes require authentication
reportRoutes.use(authenticate);

// ────────────────────────────────────────────────
// POST /api/reports/lost
// ────────────────────────────────────────────────
reportRoutes.post(
  '/lost',
  validateBody(lostReportSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const {
      category, brand, colour, description,
      location, latitude, longitude, lost_at,
      photo_url, identifying_info,
    } = req.body;

    // Optionally enrich with LLM if description is free-text
    let structured = { category, brand, colour };
    if (description.length > 50) {
      try {
        structured = await extractStructuredFields(description);
      } catch {
        // Fall back to user-supplied fields
      }
    }

    // Generate embedding for the description
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(description);
    } catch {
      // Non-fatal: matching still works without embeddings
    }

    const result = await queryOne(
      `INSERT INTO lost_items (
        user_id, category, brand, colour, description,
        location, latitude, longitude, lost_at,
        photo_url, identifying_info, description_embedding
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, ${embedding ? `$12::vector` : 'NULL'}
      )
      RETURNING id, category, brand, colour, description, location, lost_at, status, created_at`,
      embedding
        ? [userId, structured.category, structured.brand, structured.colour, description,
           location, latitude, longitude, lost_at,
           photo_url, identifying_info, `[${embedding.join(',')}]`]
        : [userId, structured.category, structured.brand, structured.colour, description,
           location, latitude, longitude, lost_at,
           photo_url, identifying_info]
    );

    // Run matching engine non-blocking: report is still returned if matching fails
    let matches: Awaited<ReturnType<typeof runMatchingEngine>> = [];
    try {
      matches = await runMatchingEngine((result as { id: string }).id, 'lost');
    } catch (matchErr) {
      console.error('Matching engine failed for lost report:', matchErr);
    }

    res.status(201).json({ ...result, matches });
  })
);

// ────────────────────────────────────────────────
// POST /api/reports/found
// ────────────────────────────────────────────────
reportRoutes.post(
  '/found',
  validateBody(foundReportSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const {
      category, brand, colour, description,
      location, latitude, longitude, found_at,
      photo_url, private_details,
    } = req.body;

    let structured = { category, brand, colour };
    if (description.length > 50) {
      try {
        structured = await extractStructuredFields(description);
      } catch {
        // Fall back
      }
    }

    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(description);
    } catch {
      // Non-fatal
    }

    const result = await queryOne(
      `INSERT INTO found_items (
        user_id, category, brand, colour, description,
        location, latitude, longitude, found_at,
        photo_url, private_details, description_embedding
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11::jsonb, ${embedding ? `$12::vector` : 'NULL'}
      )
      RETURNING id, category, brand, colour, description, location, found_at, status, created_at`,
      embedding
        ? [userId, structured.category, structured.brand, structured.colour, description,
           location, latitude, longitude, found_at,
           photo_url, JSON.stringify(private_details || {}), `[${embedding.join(',')}]`]
        : [userId, structured.category, structured.brand, structured.colour, description,
           location, latitude, longitude, found_at,
           photo_url, JSON.stringify(private_details || {})]
    );

    // Run matching engine non-blocking: report is still returned if matching fails
    let matches: Awaited<ReturnType<typeof runMatchingEngine>> = [];
    try {
      matches = await runMatchingEngine((result as { id: string }).id, 'found');
    } catch (matchErr) {
      console.error('Matching engine failed for found report:', matchErr);
    }

    res.status(201).json({ ...result, matches });
  })
);

// ────────────────────────────────────────────────
// GET /api/reports/user/:userId
// MUST be defined before /:id so Express does not treat "user" as an ID.
// ────────────────────────────────────────────────
reportRoutes.get('/user/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  // Users can only view their own reports (admins can view any)
  if (userId !== req.userId && req.userRole !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  const lostItems = await query(
    `SELECT id, category, brand, colour, description, location,
            lost_at AS event_time, photo_url, status, created_at, 'lost' AS type
     FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  const foundItems = await query(
    `SELECT id, category, brand, colour, description, location,
            found_at AS event_time, photo_url, status, created_at, 'found' AS type
     FROM found_items WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  res.json({
    lost: lostItems,
    found: foundItems,
  });
}));

// ────────────────────────────────────────────────
// GET /api/reports/:id
// ────────────────────────────────────────────────
reportRoutes.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  // Try lost_items first, then found_items
  let item = await queryOne(
    `SELECT id, user_id, category, brand, colour, description,
            location, latitude, longitude, lost_at AS event_time,
            photo_url, status, created_at, 'lost' AS type
     FROM lost_items WHERE id = $1`,
    [id]
  );

  if (!item) {
    item = await queryOne(
      `SELECT id, user_id, category, brand, colour, description,
              location, latitude, longitude, found_at AS event_time,
              photo_url, status, created_at, 'found' AS type
       FROM found_items WHERE id = $1`,
      [id]
    );
  }

  if (!item) {
    throw new AppError('Report not found', 404);
  }

  // Strip private fields for non-owners (privacy protection)
  const isOwner = (item as Record<string, unknown>).user_id === req.userId;
  if (!isOwner) {
    delete (item as Record<string, unknown>).identifying_info;
  }

  res.json(item);
}));
