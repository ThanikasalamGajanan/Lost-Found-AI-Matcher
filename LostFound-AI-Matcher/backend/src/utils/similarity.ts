/**
 * Calculate the Haversine distance in kilometres between two coordinates.
 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Convert a Haversine distance to a 0–100 similarity score.
 * Items within `maxKm` get 100; similarity decays linearly to 0 at `maxKm * 3`.
 */
export function locationSimilarity(
  lat1: number | null, lon1: number | null,
  lat2: number | null, lon2: number | null,
  maxKm: number = 5
): number {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return 50; // Neutral score when coordinates are missing
  }
  const km = haversineKm(lat1, lon1, lat2, lon2);
  if (km <= maxKm) return 100;
  if (km >= maxKm * 3) return 0;
  return Math.round(100 * (1 - (km - maxKm) / (maxKm * 2)));
}

/**
 * Time proximity score: 100 if within `windowHours`, decays linearly.
 */
export function timeSimilarity(
  time1: Date | string,
  time2: Date | string,
  windowHours: number = 72
): number {
  const t1 = new Date(time1).getTime();
  const t2 = new Date(time2).getTime();
  const diffHours = Math.abs(t1 - t2) / (1000 * 60 * 60);

  if (diffHours <= windowHours) return 100;
  if (diffHours >= windowHours * 4) return 0;
  return Math.round(100 * (1 - (diffHours - windowHours) / (windowHours * 3)));
}

/**
 * Attribute similarity: compares category, brand, and colour.
 * Returns a score from 0–100.
 */
export function attributeSimilarity(
  a: { category?: string; brand?: string; colour?: string },
  b: { category?: string; brand?: string; colour?: string }
): number {
  let score = 0;
  const fields: Array<'category' | 'brand' | 'colour'> = ['category', 'brand', 'colour'];
  const weights = { category: 50, brand: 25, colour: 25 };

  for (const field of fields) {
    const va = (a[field] ?? '').toLowerCase().trim();
    const vb = (b[field] ?? '').toLowerCase().trim();

    if (!va || !vb) continue;
    if (va === vb) {
      score += weights[field];
    } else if (va.includes(vb) || vb.includes(va)) {
      score += weights[field] * 0.6;
    }
  }

  return Math.min(100, Math.round(score));
}
