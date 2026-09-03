import {
  locationSimilarity,
  timeSimilarity,
  attributeSimilarity,
} from '../utils/similarity.js';

interface TestItem {
  category: string;
  brand: string;
  colour: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  time: string;
}

interface TestPair {
  name: string;
  lost: TestItem;
  found: TestItem;
  imageScore: number;
  expected: 'high' | 'medium' | 'no match';
}

const WEIGHTS = {
  description: 0.30,
  image: 0.25,
  location: 0.20,
  time: 0.15,
  attributes: 0.10,
};

const LOCATION_RADIUS_KM = 5;
const TIME_WINDOW_HOURS = 72;

function descriptionSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

function expectedOutcome(total: number): 'high' | 'medium' | 'no match' {
  if (total >= 70) return 'high';
  if (total >= 40) return 'medium';
  return 'no match';
}

const pairs: TestPair[] = [
  {
    name: 'Black Lenovo laptop bag vs Dark laptop backpack (same place)',
    lost: {
      category: 'bag',
      brand: 'Lenovo',
      colour: 'black',
      description: 'Black Lenovo laptop bag with two compartments',
      location: 'Colombo Fort Railway Station',
      latitude: 6.9355,
      longitude: 79.8487,
      time: '2024-12-15T08:30:00Z',
    },
    found: {
      category: 'bag',
      brand: 'Lenovo',
      colour: 'black',
      description: 'Black Lenovo laptop bag found near the ticket counter',
      location: 'Colombo Fort Railway Station',
      latitude: 6.9356,
      longitude: 79.849,
      time: '2024-12-15T09:15:00Z',
    },
    imageScore: 75,
    expected: 'high',
  },
  {
    name: 'Silver Toyota car keys vs Found car keys with leather keychain',
    lost: {
      category: 'keys',
      brand: 'Toyota',
      colour: 'silver',
      description: 'Silver Toyota car keys with small leather keychain and gym tag',
      location: 'Colombo Fort Railway Station',
      latitude: 6.9355,
      longitude: 79.8487,
      time: '2024-12-15T08:30:00Z',
    },
    found: {
      category: 'keys',
      brand: 'Toyota',
      colour: 'silver',
      description: 'Found car keys with leather keychain and gym membership tag',
      location: 'Colombo Fort Railway Station',
      latitude: 6.9355,
      longitude: 79.8487,
      time: '2024-12-15T09:15:00Z',
    },
    imageScore: 80,
    expected: 'high',
  },
  {
    name: 'Red umbrella vs Black wallet (different place and item)',
    lost: {
      category: 'umbrella',
      brand: '',
      colour: 'red',
      description: 'Red foldable umbrella with wooden handle',
      location: 'Colombo Fort Railway Station',
      latitude: 6.9355,
      longitude: 79.8487,
      time: '2024-12-15T08:30:00Z',
    },
    found: {
      category: 'wallet',
      brand: '',
      colour: 'black',
      description: 'Black leather wallet with multiple cards inside',
      location: 'Kandy',
      latitude: 7.2906,
      longitude: 80.6337,
      time: '2024-12-15T09:15:00Z',
    },
    imageScore: 10,
    expected: 'no match',
  },
  {
    name: 'iPhone 14 vs Found iPhone (different city)',
    lost: {
      category: 'electronics',
      brand: 'Apple',
      colour: 'black',
      description: 'Lost iPhone 14 with black case near the café',
      location: 'Colombo City Centre',
      latitude: 6.9271,
      longitude: 79.8612,
      time: '2024-12-15T08:30:00Z',
    },
    found: {
      category: 'electronics',
      brand: 'Apple',
      colour: 'black',
      description: 'Found iPhone with black case at a bus stop',
      location: 'Kandy',
      latitude: 7.2906,
      longitude: 80.6337,
      time: '2024-12-16T08:30:00Z',
    },
    imageScore: 80,
    expected: 'medium',
  },
  {
    name: 'Blue Nike water bottle vs Found blue water bottle (same place)',
    lost: {
      category: 'bottle',
      brand: 'Nike',
      colour: 'blue',
      description: 'Blue Nike water bottle with sipper lid',
      location: 'Viharamahadevi Park',
      latitude: 6.913,
      longitude: 79.8615,
      time: '2024-12-15T10:00:00Z',
    },
    found: {
      category: 'bottle',
      brand: 'Nike',
      colour: 'blue',
      description: 'Blue Nike water bottle found near the park bench',
      location: 'Viharamahadevi Park',
      latitude: 6.9132,
      longitude: 79.8617,
      time: '2024-12-15T11:00:00Z',
    },
    imageScore: 70,
    expected: 'high',
  },
  {
    name: 'Gold ring with emerald vs Found gold ring (same place)',
    lost: {
      category: 'jewellery',
      brand: '',
      colour: 'gold',
      description: 'Gold ring with emerald stone size small',
      location: 'Galle Face Hotel',
      latitude: 6.9196,
      longitude: 79.8422,
      time: '2024-12-14T19:00:00Z',
    },
    found: {
      category: 'jewellery',
      brand: '',
      colour: 'gold',
      description: 'Found gold ring with green stone at hotel lobby',
      location: 'Galle Face Hotel',
      latitude: 6.9196,
      longitude: 79.8422,
      time: '2024-12-14T20:00:00Z',
    },
    imageScore: 85,
    expected: 'high',
  },
  {
    name: 'Prescription glasses vs Sunglasses (same place, different colour)',
    lost: {
      category: 'glasses',
      brand: '',
      colour: 'black',
      description: 'Black prescription glasses with metal frame',
      location: 'Odel Department Store',
      latitude: 6.918,
      longitude: 79.85,
      time: '2024-12-15T14:00:00Z',
    },
    found: {
      category: 'glasses',
      brand: '',
      colour: 'brown',
      description: 'Found brown sunglasses with plastic frame',
      location: 'Odel Department Store',
      latitude: 6.918,
      longitude: 79.85,
      time: '2024-12-15T15:00:00Z',
    },
    imageScore: 50,
    expected: 'medium',
  },
  {
    name: 'Black leather wallet vs Brown wallet (same place)',
    lost: {
      category: 'wallet',
      brand: '',
      colour: 'black',
      description: 'Black leather wallet with ID window',
      location: 'Marino Mall',
      latitude: 6.888,
      longitude: 79.868,
      time: '2024-12-15T16:00:00Z',
    },
    found: {
      category: 'wallet',
      brand: '',
      colour: 'brown',
      description: 'Found brown wallet near the food court',
      location: 'Marino Mall',
      latitude: 6.8882,
      longitude: 79.8682,
      time: '2024-12-15T17:00:00Z',
    },
    imageScore: 55,
    expected: 'medium',
  },
  {
    name: 'White AirPods case vs White earbuds case (same place)',
    lost: {
      category: 'electronics',
      brand: 'Apple',
      colour: 'white',
      description: 'White AirPods charging case with small dent',
      location: 'Colombo Fort Railway Station',
      latitude: 6.9355,
      longitude: 79.8487,
      time: '2024-12-15T08:30:00Z',
    },
    found: {
      category: 'electronics',
      brand: 'Apple',
      colour: 'white',
      description: 'Found white earbuds charging case at railway station',
      location: 'Colombo Fort Railway Station',
      latitude: 6.9355,
      longitude: 79.8487,
      time: '2024-12-15T09:00:00Z',
    },
    imageScore: 85,
    expected: 'high',
  },
  {
    name: 'School ID card vs Credit card (different type and place)',
    lost: {
      category: 'document',
      brand: '',
      colour: 'white',
      description: 'School ID card with blue lanyard',
      location: 'Royal College Grounds',
      latitude: 6.904,
      longitude: 79.862,
      time: '2024-12-15T09:00:00Z',
    },
    found: {
      category: 'document',
      brand: '',
      colour: 'black',
      description: 'Found credit card near the canteen',
      location: 'Kandy',
      latitude: 7.2906,
      longitude: 80.6337,
      time: '2024-12-20T09:30:00Z',
    },
    imageScore: 15,
    expected: 'no match',
  },
];

function runTests(): void {
  const rows = pairs.map((pair) => {
    const descScore = descriptionSimilarity(pair.lost.description, pair.found.description);
    const locScore = locationSimilarity(
      pair.lost.latitude,
      pair.lost.longitude,
      pair.found.latitude,
      pair.found.longitude,
      LOCATION_RADIUS_KM
    );
    const timeScore = timeSimilarity(pair.lost.time, pair.found.time, TIME_WINDOW_HOURS);
    const attrScore = attributeSimilarity(
      { category: pair.lost.category, brand: pair.lost.brand, colour: pair.lost.colour },
      { category: pair.found.category, brand: pair.found.brand, colour: pair.found.colour }
    );

    const total = Math.round(
      descScore * WEIGHTS.description +
        pair.imageScore * WEIGHTS.image +
        locScore * WEIGHTS.location +
        timeScore * WEIGHTS.time +
        attrScore * WEIGHTS.attributes
    );

    const actualOutcome = expectedOutcome(total);
    const pass = actualOutcome === pair.expected ? 'PASS' : 'FAIL';

    return {
      Pair: pair.name,
      'Desc (30%)': descScore,
      'Image (25%)': pair.imageScore,
      'Loc (20%)': locScore,
      'Time (15%)': timeScore,
      'Attr (10%)': attrScore,
      'Total (%)': total,
      Expected: pair.expected,
      Actual: actualOutcome,
      Result: pass,
    };
  });

  console.log('\n=== Lost & Found Matching Engine — Scoring Test ===\n');
  console.table(rows);

  const passed = rows.filter((r) => r.Result === 'PASS').length;
  const failed = rows.length - passed;
  console.log(`\nSummary: ${passed}/${rows.length} passed, ${failed} failed.`);
}

runTests();
