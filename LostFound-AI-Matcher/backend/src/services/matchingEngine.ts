import { query, queryOne } from '../db/pool.js';
import { config } from '../config/index.js';
import { cosineSimilarity, imageSimilarity } from './llmService.js';
import { locationSimilarity, timeSimilarity, attributeSimilarity } from '../utils/similarity.js';
import { createNotification } from './notificationService.js';

interface ItemRecord {
  id: string;
  user_id: string;
  category: string;
  brand: string;
  colour: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  event_time: string;
  photo_url: string | null;
  description_embedding: string | null;  // pgvector comes back as string
}

interface MatchResult {
  lost_item_id: string;
  found_item_id: string;
  total_score: number;
  desc_score: number;
  image_score: number;
  location_score: number;
  time_score: number;
  attr_score: number;
}

/**
 * Run the weighted matching engine for a given report.
 * Compares a lost item against all active found items (or vice versa).
 */
export async function runMatchingEngine(
  reportId: string,
  type: 'lost' | 'found'
): Promise<MatchResult[]> {
  const weights = config.matching.weights;

  // 1. Fetch the source item
  const sourceTable = type === 'lost' ? 'lost_items' : 'found_items';
  const targetTable = type === 'lost' ? 'found_items' : 'lost_items';
  const timeField = type === 'lost' ? 'lost_at' : 'found_at';
  const targetTimeField = type === 'lost' ? 'found_at' : 'lost_at';

  const source = await queryOne<ItemRecord>(
    `SELECT id, user_id, category, brand, colour, description,
            location, latitude, longitude,
            ${timeField} AS event_time,
            photo_url,
            description_embedding::text AS description_embedding
     FROM ${sourceTable} WHERE id = $1`,
    [reportId]
  );

  if (!source) {
    throw new Error('Source item not found');
  }

  // 2. Fetch all active items from the opposing table
  //    (exclude items owned by the same user)
  const candidates = await query<ItemRecord>(
    `SELECT id, user_id, category, brand, colour, description,
            location, latitude, longitude,
            ${targetTimeField} AS event_time,
            photo_url,
            description_embedding::text AS description_embedding
     FROM ${targetTable}
     WHERE status = 'active' AND user_id != $1`,
    [source.user_id]
  );

  if (candidates.length === 0) {
    return [];
  }

  // 3. Score each candidate
  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    // --- Description similarity (40%) — embedding cosine distance ---
    let descScore = 50; // default neutral when no embeddings available
    if (source.description_embedding && candidate.description_embedding) {
      try {
        const srcEmbedding = parseVector(source.description_embedding);
        const candEmbedding = parseVector(candidate.description_embedding);
        descScore = cosineSimilarity(srcEmbedding, candEmbedding);
      } catch {
        // Fallback: simple text overlap
        descScore = simpleTextSimilarity(source.description, candidate.description);
      }
    } else {
      descScore = simpleTextSimilarity(source.description, candidate.description);
    }

    // --- Location similarity (27%) — Haversine proximity ---
    const locScore = locationSimilarity(
      source.latitude, source.longitude,
      candidate.latitude, candidate.longitude,
      config.matching.locationRadiusKm
    );

    // --- Time similarity (20%) — time-window overlap ---
    const tScore = timeSimilarity(
      source.event_time,
      candidate.event_time,
      config.matching.timeWindowHours
    );

    // --- Attribute similarity (13%) — category / colour / brand ---
    const attrScore = attributeSimilarity(
      { category: source.category, brand: source.brand, colour: source.colour },
      { category: candidate.category, brand: candidate.brand, colour: candidate.colour }
    );

    // --- Image similarity (25%) — only when both items have photos ---
    let imageScore = 50; // neutral default
    if (source.photo_url && candidate.photo_url) {
      imageScore = await imageSimilarity(source.photo_url, candidate.photo_url);
    }

    // --- Weighted total (0–100) ---
    const totalScore = Math.round(
      descScore * weights.description +
      imageScore * weights.image +
      locScore * weights.location +
      tScore * weights.time +
      attrScore * weights.attributes
    );

    // Only surface matches above the threshold
    if (totalScore >= config.matching.minScoreThreshold) {
      results.push({
        lost_item_id: type === 'lost' ? source.id : candidate.id,
        found_item_id: type === 'found' ? source.id : candidate.id,
        total_score: totalScore,
        desc_score: descScore,
        image_score: imageScore,
        location_score: locScore,
        time_score: tScore,
        attr_score: attrScore,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.total_score - a.total_score);

  // 4. Upsert matches into the database
  for (const match of results) {
    await query(
      `INSERT INTO matches (lost_item_id, found_item_id, total_score, desc_score, image_score, location_score, time_score, attr_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (lost_item_id, found_item_id)
       DO UPDATE SET
         total_score = EXCLUDED.total_score,
         desc_score = EXCLUDED.desc_score,
         image_score = EXCLUDED.image_score,
         location_score = EXCLUDED.location_score,
         time_score = EXCLUDED.time_score,
         attr_score = EXCLUDED.attr_score,
         status = 'pending'`,
      [
        match.lost_item_id, match.found_item_id, match.total_score,
        match.desc_score, match.image_score, match.location_score,
        match.time_score, match.attr_score,
      ]
    );
  }

  // 5. Send notifications for new matches
  if (results.length > 0) {
    const topMatch = results[0];
    const lostOwnerId = topMatch.lost_item_id === reportId ? source.user_id : (await queryOne<{ user_id: string }>('SELECT user_id FROM lost_items WHERE id = $1', [topMatch.lost_item_id]))?.user_id;
    const foundOwnerId = topMatch.found_item_id === reportId ? source.user_id : (await queryOne<{ user_id: string }>('SELECT user_id FROM found_items WHERE id = $1', [topMatch.found_item_id]))?.user_id;

    if (lostOwnerId) {
      await createNotification(lostOwnerId, 'new_match', 'New match found!', `Your lost item has a ${topMatch.total_score}% match with a found item.`, topMatch.lost_item_id, 'lost');
    }
    if (foundOwnerId) {
      await createNotification(foundOwnerId, 'new_match', 'New match found!', `A lost item matches your found item at ${topMatch.total_score}%.`, topMatch.found_item_id, 'found');
    }
  }

  return results;
}

/**
 * Parse a pgvector string like "[0.1,0.2,...]" into a number array.
 */
function parseVector(vectorStr: string): number[] {
  return JSON.parse(vectorStr);
}

/**
 * Fallback: simple word overlap similarity between two text strings.
 */
function simpleTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}
