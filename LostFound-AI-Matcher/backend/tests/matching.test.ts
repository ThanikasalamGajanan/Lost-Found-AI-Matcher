import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/index.js', () => ({
  config: {
    matching: {
      weights: {
        description: 0.30,
        image: 0.25,
        location: 0.20,
        time: 0.15,
        attributes: 0.10,
      },
      minScoreThreshold: 0, // include all matches so we can inspect scores
      locationRadiusKm: 5,
      timeWindowHours: 72,
    },
  },
}));

vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock('../src/services/llmService.js', () => ({
  cosineSimilarity: vi.fn(),
  imageSimilarity: vi.fn(),
}));

vi.mock('../src/services/notificationService.js', () => ({
  createNotification: vi.fn(),
}));

import { runMatchingEngine } from '../src/services/matchingEngine';
import { query, queryOne } from '../src/db/pool.js';
import { cosineSimilarity, imageSimilarity } from '../src/services/llmService.js';

const mockedQuery = vi.mocked(query);
const mockedQueryOne = vi.mocked(queryOne);
const mockedCosineSimilarity = vi.mocked(cosineSimilarity);
const mockedImageSimilarity = vi.mocked(imageSimilarity);

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    user_id: 'user-1',
    category: 'bag',
    brand: 'Lenovo',
    colour: 'black',
    description: 'Black Lenovo laptop bag',
    location: 'Colombo Fort Railway Station',
    latitude: 6.9355,
    longitude: 79.8487,
    event_time: '2024-12-15T08:30:00Z',
    photo_url: null,
    description_embedding: '[0.1,0.2,0.3]',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedQuery.mockResolvedValue([]);
  mockedQueryOne.mockResolvedValue(null);
  mockedImageSimilarity.mockResolvedValue(50);
});

describe('runMatchingEngine', () => {
  it('scores nearly identical items above 80%', async () => {
    const source = makeItem({ id: 'lost-1', user_id: 'user-1' });
    const candidate = makeItem({
      id: 'found-1',
      user_id: 'user-2',
      description: 'Found a black Lenovo laptop bag at the station',
      photo_url: 'http://example.com/bag.jpg',
      description_embedding: '[0.2,0.3,0.4]',
    });

    mockedQueryOne.mockImplementation(async (_sql, params) => {
      if (params?.[0] === 'lost-1') return source;
      return null;
    });
    mockedQuery.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM found_items')) return [candidate];
      return [];
    });
    mockedCosineSimilarity.mockReturnValue(95);
    mockedImageSimilarity.mockResolvedValue(90);

    const results = await runMatchingEngine('lost-1', 'lost');

    expect(results).toHaveLength(1);
    expect(results[0].total_score).toBeGreaterThan(80);
    expect(results[0].lost_item_id).toBe('lost-1');
    expect(results[0].found_item_id).toBe('found-1');
  });

  it('scores completely different items below 40%', async () => {
    const source = makeItem({
      id: 'lost-keys',
      user_id: 'user-1',
      category: 'keys',
      brand: 'Toyota',
      colour: 'silver',
      description: 'Silver Toyota car keys',
    });
    const candidate = makeItem({
      id: 'found-bag',
      user_id: 'user-2',
      category: 'bag',
      brand: 'Lenovo',
      colour: 'black',
      description: 'Black Lenovo laptop bag found far away',
      location: 'Kandy',
      latitude: 7.2906,
      longitude: 80.6337,
      event_time: '2024-12-20T08:30:00Z',
      description_embedding: '[0.9,0.8,0.7]',
    });

    mockedQueryOne.mockImplementation(async (_sql, params) => {
      if (params?.[0] === 'lost-keys') return source;
      return null;
    });
    mockedQuery.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM found_items')) return [candidate];
      return [];
    });
    mockedCosineSimilarity.mockReturnValue(10);

    const results = await runMatchingEngine('lost-keys', 'lost');

    expect(results).toHaveLength(1);
    expect(results[0].total_score).toBeLessThan(40);
  });

  it('scores same category but different location/time as medium', async () => {
    const source = makeItem({ id: 'lost-bag', user_id: 'user-1' });
    const candidate = makeItem({
      id: 'found-bag',
      user_id: 'user-2',
      description: 'Black Lenovo laptop bag found elsewhere',
      // ~10 km away from Colombo Fort
      latitude: 6.94,
      longitude: 79.95,
      // ~6 days later
      event_time: '2024-12-21T14:30:00Z',
      description_embedding: '[0.2,0.3,0.4]',
    });

    mockedQueryOne.mockImplementation(async (_sql, params) => {
      if (params?.[0] === 'lost-bag') return source;
      return null;
    });
    mockedQuery.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM found_items')) return [candidate];
      return [];
    });
    mockedCosineSimilarity.mockReturnValue(60);

    const results = await runMatchingEngine('lost-bag', 'lost');

    expect(results).toHaveLength(1);
    expect(results[0].total_score).toBeGreaterThan(40);
    expect(results[0].total_score).toBeLessThan(80);
  });

  it('falls back to simpleTextSimilarity when embeddings are missing', async () => {
    const source = makeItem({
      id: 'lost-bag',
      user_id: 'user-1',
      description: 'black lenovo laptop bag',
      description_embedding: null,
    });
    const candidate = makeItem({
      id: 'found-bag',
      user_id: 'user-2',
      description: 'found a black lenovo laptop bag',
      description_embedding: null,
    });

    mockedQueryOne.mockImplementation(async (_sql, params) => {
      if (params?.[0] === 'lost-bag') return source;
      return null;
    });
    mockedQuery.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM found_items')) return [candidate];
      return [];
    });
    mockedCosineSimilarity.mockReturnValue(0);

    const results = await runMatchingEngine('lost-bag', 'lost');

    expect(results).toHaveLength(1);
    expect(results[0].desc_score).toBeGreaterThan(50);
    expect(mockedCosineSimilarity).not.toHaveBeenCalled();
  });
});
