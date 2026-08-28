import { query } from '../db/pool.js';

/**
 * A single result from an embedding-based similarity search.
 */
export interface SimilarItem {
  id: string;
  category: string;
  brand: string | null;
  colour: string | null;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  event_time: string;
  photo_url: string | null;
  similarity_score: number; // 0–100
}

/**
 * Search active lost items by cosine similarity to a given embedding vector.
 * Uses pgvector's native `<=>` (cosine distance) operator so the comparison
 * runs entirely inside PostgreSQL — no rows are fetched into Node.
 *
 * @param embedding    The query embedding as a number array (1536 dims).
 * @param excludeUserId  Exclude items owned by this user (the submitter).
 * @param limit        Max number of results (default 3).
 * @param minScore     Minimum similarity % to include (default 30).
 */
export async function findSimilarLostItems(
  embedding: number[],
  excludeUserId: string,
  limit: number = 3,
  minScore: number = 30
): Promise<SimilarItem[]> {
  const vectorStr = `[${embedding.join(',')}]`;

  return query<SimilarItem>(
    `SELECT
       id,
       category,
       brand,
       colour,
       description,
       location,
       latitude,
       longitude,
       lost_at AS event_time,
       photo_url,
       ROUND(
         (1 - (description_embedding <=> $1::vector)) * 100
       ) AS similarity_score
     FROM lost_items
     WHERE status = 'active'
       AND user_id != $2
       AND description_embedding IS NOT NULL
       AND (1 - (description_embedding <=> $1::vector)) >= $4
     ORDER BY description_embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, excludeUserId, limit, minScore / 100]
  );
}

/**
 * Search active found items by cosine similarity to a given embedding vector.
 * Mirror of findSimilarLostItems for the reverse direction.
 */
export async function findSimilarFoundItems(
  embedding: number[],
  excludeUserId: string,
  limit: number = 3,
  minScore: number = 30
): Promise<SimilarItem[]> {
  const vectorStr = `[${embedding.join(',')}]`;

  return query<SimilarItem>(
    `SELECT
       id,
       category,
       brand,
       colour,
       description,
       location,
       latitude,
       longitude,
       found_at AS event_time,
       photo_url,
       ROUND(
         (1 - (description_embedding <=> $1::vector)) * 100
       ) AS similarity_score
     FROM found_items
     WHERE status = 'active'
       AND user_id != $2
       AND description_embedding IS NOT NULL
       AND (1 - (description_embedding <=> $1::vector)) >= $4
     ORDER BY description_embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, excludeUserId, limit, minScore / 100]
  );
}
