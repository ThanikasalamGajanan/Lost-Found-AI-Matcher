import { describe, it, expect } from 'vitest';
import { locationSimilarity, timeSimilarity, attributeSimilarity } from '../src/utils/similarity';

describe('locationSimilarity', () => {
  it('returns 100 for identical coordinates', () => {
    expect(locationSimilarity(6.9271, 79.8612, 6.9271, 79.8612)).toBe(100);
  });

  it('returns 50 when coordinates are missing', () => {
    expect(locationSimilarity(null, null, 6.9271, 79.8612)).toBe(50);
  });

  it('returns high score for nearby locations', () => {
    // Colombo to nearby suburb (~3km)
    const score = locationSimilarity(6.9271, 79.8612, 6.9400, 79.8700);
    expect(score).toBeGreaterThan(80);
  });

  it('returns low score for distant locations', () => {
    // Colombo to another city (100+ km)
    const score = locationSimilarity(6.9271, 79.8612, 7.2906, 80.6337);
    expect(score).toBeLessThan(10);
  });
});

describe('timeSimilarity', () => {
  it('returns 100 for same time', () => {
    const t = '2024-01-15T10:00:00Z';
    expect(timeSimilarity(t, t)).toBe(100);
  });

  it('returns 100 within the window', () => {
    const t1 = '2024-01-15T10:00:00Z';
    const t2 = '2024-01-16T10:00:00Z'; // 24 hours later
    expect(timeSimilarity(t1, t2, 72)).toBe(100);
  });

  it('returns low score for very different times', () => {
    const t1 = '2024-01-01T10:00:00Z';
    const t2 = '2024-03-01T10:00:00Z'; // ~2 months
    expect(timeSimilarity(t1, t2, 72)).toBe(0);
  });
});

describe('attributeSimilarity', () => {
  it('returns 100 for identical attributes', () => {
    const attrs = { category: 'keys', brand: 'Toyota', colour: 'silver' };
    expect(attributeSimilarity(attrs, attrs)).toBe(100);
  });

  it('returns partial score for matching category only', () => {
    const a = { category: 'keys', brand: '', colour: '' };
    const b = { category: 'keys', brand: '', colour: '' };
    expect(attributeSimilarity(a, b)).toBe(50);
  });

  it('returns 0 for completely different attributes', () => {
    const a = { category: 'keys', brand: 'Toyota', colour: 'silver' };
    const b = { category: 'electronics', brand: 'Apple', colour: 'black' };
    expect(attributeSimilarity(a, b)).toBe(0);
  });

  it('handles partial string matches', () => {
    const a = { category: 'electronics', brand: 'Apple', colour: 'dark blue' };
    const b = { category: 'electronics', brand: 'Apple Inc', colour: 'blue' };
    const score = attributeSimilarity(a, b);
    expect(score).toBeGreaterThan(70);
  });
});
