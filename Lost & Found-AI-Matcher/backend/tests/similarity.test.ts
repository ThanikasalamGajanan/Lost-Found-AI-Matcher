import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  locationSimilarity,
  timeSimilarity,
  attributeSimilarity,
} from '../src/utils/similarity';

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(6.9271, 79.8612, 6.9271, 79.8612)).toBe(0);
  });

  it('calculates a short known distance accurately', () => {
    // Colombo Fort Railway Station to Colombo City Centre (approx. 1.6 km)
    const km = haversineKm(6.9355, 79.8487, 6.9271, 79.8612);
    expect(km).toBeGreaterThan(1);
    expect(km).toBeLessThan(2.5);
  });

  it('calculates a medium known distance accurately', () => {
    // Colombo to Kandy (approx. 95 km)
    const km = haversineKm(6.9271, 79.8612, 7.2906, 80.6337);
    expect(km).toBeGreaterThan(90);
    expect(km).toBeLessThan(100);
  });

  it('calculates a long known distance accurately', () => {
    // New York to London (approx. 5570 km)
    const km = haversineKm(40.7128, -74.006, 51.5074, -0.1278);
    expect(km).toBeGreaterThan(5500);
    expect(km).toBeLessThan(5600);
  });
});

describe('locationSimilarity', () => {
  it('returns 100 for identical coordinates', () => {
    expect(locationSimilarity(6.9271, 79.8612, 6.9271, 79.8612)).toBe(100);
  });

  it('returns 100 for coordinates within maxKm', () => {
    // ~1.6 km apart, default maxKm = 5
    expect(locationSimilarity(6.9355, 79.8487, 6.9271, 79.8612)).toBe(100);
  });

  it('returns a high decayed score for coordinates between maxKm and 3*maxKm', () => {
    // ~10 km apart with maxKm = 5 -> expected roughly 50
    const score = locationSimilarity(6.9271, 79.8612, 6.9407, 79.9496, 5);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('returns 0 for coordinates beyond 3*maxKm', () => {
    // Colombo to Kandy, well beyond 15 km
    expect(locationSimilarity(6.9271, 79.8612, 7.2906, 80.6337)).toBe(0);
  });

  it('returns 50 when the first coordinate pair is null', () => {
    expect(locationSimilarity(null, null, 6.9271, 79.8612)).toBe(50);
  });

  it('returns 50 when the second coordinate pair is null', () => {
    expect(locationSimilarity(6.9271, 79.8612, null, null)).toBe(50);
  });

  it('returns 50 when all coordinates are null', () => {
    expect(locationSimilarity(null, null, null, null)).toBe(50);
  });
});

describe('timeSimilarity', () => {
  it('returns 100 for identical timestamps', () => {
    const t = '2024-01-15T10:00:00Z';
    expect(timeSimilarity(t, t)).toBe(100);
  });

  it('returns 100 for timestamps within the window', () => {
    const t1 = '2024-01-15T10:00:00Z';
    const t2 = '2024-01-16T10:00:00Z'; // 24 hours later, within default 72h window
    expect(timeSimilarity(t1, t2)).toBe(100);
  });

  it('returns a decayed score for timestamps between window and 4*window', () => {
    const t1 = '2024-01-15T10:00:00Z';
    const t2 = '2024-01-18T10:00:00Z'; // 72 hours later, exactly at window edge -> still 100
    const t3 = '2024-01-19T10:00:00Z'; // 96 hours later -> decayed
    expect(timeSimilarity(t1, t2)).toBe(100);
    const score = timeSimilarity(t1, t3);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('returns 0 for timestamps far apart', () => {
    const t1 = '2024-01-01T10:00:00Z';
    const t2 = '2024-03-01T10:00:00Z';
    expect(timeSimilarity(t1, t2)).toBe(0);
  });

  it('accepts Date objects', () => {
    const t1 = new Date('2024-01-15T10:00:00Z');
    const t2 = new Date('2024-01-15T12:00:00Z');
    expect(timeSimilarity(t1, t2)).toBe(100);
  });
});

describe('attributeSimilarity', () => {
  it('returns 100 for exact match of all fields', () => {
    const attrs = { category: 'keys', brand: 'Toyota', colour: 'silver' };
    expect(attributeSimilarity(attrs, attrs)).toBe(100);
  });

  it('is case-insensitive', () => {
    const a = { category: 'Keys', brand: 'Toyota', colour: 'Silver' };
    const b = { category: 'keys', brand: 'toyota', colour: 'SILVER' };
    expect(attributeSimilarity(a, b)).toBe(100);
  });

  it('returns 0 when no attributes match', () => {
    const a = { category: 'keys', brand: 'Toyota', colour: 'silver' };
    const b = { category: 'electronics', brand: 'Apple', colour: 'black' };
    expect(attributeSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when all fields are missing on one side', () => {
    const a = { category: 'keys', brand: 'Toyota', colour: 'silver' };
    const b = {};
    expect(attributeSimilarity(a, b)).toBe(0);
  });

  it('scores category-only match as 50', () => {
    const a = { category: 'keys' };
    const b = { category: 'keys' };
    expect(attributeSimilarity(a, b)).toBe(50);
  });

  it('scores category + brand match as 75', () => {
    const a = { category: 'keys', brand: 'Toyota' };
    const b = { category: 'keys', brand: 'Toyota' };
    expect(attributeSimilarity(a, b)).toBe(75);
  });

  it('gives partial credit for substring matches', () => {
    const a = { category: 'electronics', brand: 'Apple', colour: 'dark blue' };
    const b = { category: 'electronics', brand: 'Apple Inc', colour: 'blue' };
    const score = attributeSimilarity(a, b);
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThan(100);
  });

  it('ignores whitespace in comparisons', () => {
    const a = { category: '  keys  ', brand: 'Toyota', colour: 'silver' };
    const b = { category: 'keys', brand: ' Toyota ', colour: 'silver' };
    expect(attributeSimilarity(a, b)).toBe(100);
  });

  it('treats undefined fields as empty strings', () => {
    const a = { category: 'keys', brand: undefined, colour: 'silver' };
    const b = { category: 'keys', brand: undefined, colour: 'silver' };
    expect(attributeSimilarity(a, b)).toBe(75);
  });
});
