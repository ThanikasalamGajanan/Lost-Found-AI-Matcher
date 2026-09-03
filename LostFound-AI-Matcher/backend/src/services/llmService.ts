import OpenAI from 'openai';
import { config } from '../config/index.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Generate a 1536-dim embedding for a text string using text-embedding-3-small.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Returns a value between 0 and 1 (mapped to 0–100 score).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

  // Map from [-1, 1] range to [0, 100]
  return Math.round(((similarity + 1) / 2) * 100);
}

/**
 * Extract structured fields (category, brand, colour) from a free-text
 * item description using GPT-4o-mini.
 */
export async function extractStructuredFields(
  description: string
): Promise<{ category: string; brand: string; colour: string }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You extract structured data from lost-and-found item descriptions.
Return a JSON object with exactly these fields:
- category: one of [keys, electronics, bag, wallet, jewellery, clothing, document, umbrella, bottle, glasses, other]
- brand: the brand name if mentioned, or empty string
- colour: the primary colour if mentioned, or empty string
Return ONLY the JSON object, no markdown.`,
      },
      {
        role: 'user',
        content: description,
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content || '{}';
  const parsed = JSON.parse(content);

  return {
    category: parsed.category || 'other',
    brand: parsed.brand || '',
    colour: parsed.colour || '',
  };
}

/**
 * Compare two images using GPT-4o vision to determine visual similarity.
 * Returns a score from 0–100.
 */
export async function imageSimilarity(
  imageUrl1: string,
  imageUrl2: string
): Promise<number> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are comparing two images of items to determine if they could be the same item.
Look at: colour, shape, size, material, distinctive features.
Return ONLY a JSON object: {"similarity": <number 0-100>, "reasoning": "<brief explanation>"}`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these two item images for similarity:' },
            { type: 'image_url', image_url: { url: imageUrl1 } },
            { type: 'image_url', image_url: { url: imageUrl2 } },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);
    return Math.min(100, Math.max(0, parsed.similarity || 50));
  } catch {
    // If images can't be compared (e.g. URLs invalid), return neutral score
    return 50;
  }
}
