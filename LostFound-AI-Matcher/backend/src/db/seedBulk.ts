import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';
import { supabaseAdmin } from './supabase.js';
import { generateEmbedding } from '../services/llmService.js';
import { runMatchingEngine } from '../services/matchingEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SeedItem {
  category: string;
  brand: string;
  colour: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  lost_at?: string;
  found_at?: string;
  private_details?: Record<string, string>;
}

interface InsertedItem {
  id: string;
  type: 'lost' | 'found';
}

async function ensureTestUser(): Promise<string> {
  const testEmail = 'admin@test.com';
  const testPassword = 'TestPassword123!';

  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`);
  }

  const existingUser = listData.users.find((u) => u.email === testEmail);

  let testUserId: string;
  if (existingUser) {
    testUserId = existingUser.id;
    console.log(`Using existing auth user: ${testEmail} (${testUserId})`);
  } else {
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Admin User' },
    });

    if (createError || !createData.user) {
      throw new Error(`Failed to create auth user: ${createError?.message ?? 'unknown error'}`);
    }

    testUserId = createData.user.id;
    console.log(`Created auth user: ${testEmail} (${testUserId})`);
  }

  await pool.query(
    `INSERT INTO users (id, email, full_name, role)
     VALUES ($1, $2, 'Admin User', 'admin')
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role`,
    [testUserId, testEmail]
  );

  return testUserId;
}

function formatVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

async function insertLostItem(userId: string, item: SeedItem): Promise<string | null> {
  const embedding = await generateEmbedding(item.description);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO lost_items
       (user_id, category, brand, colour, description, location, latitude, longitude, lost_at, description_embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector)
     RETURNING id`,
    [
      userId,
      item.category,
      item.brand,
      item.colour,
      item.description,
      item.location,
      item.latitude,
      item.longitude,
      item.lost_at,
      formatVector(embedding),
    ]
  );
  return result.rows[0]?.id ?? null;
}

async function insertFoundItem(userId: string, item: SeedItem): Promise<string | null> {
  const embedding = await generateEmbedding(item.description);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO found_items
       (user_id, category, brand, colour, description, location, latitude, longitude, found_at, private_details, description_embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector)
     RETURNING id`,
    [
      userId,
      item.category,
      item.brand,
      item.colour,
      item.description,
      item.location,
      item.latitude,
      item.longitude,
      item.found_at,
      JSON.stringify(item.private_details ?? {}),
      formatVector(embedding),
    ]
  );
  return result.rows[0]?.id ?? null;
}

async function seedBulk(): Promise<void> {
  console.log('Starting bulk seed...\n');

  const lostPath = path.resolve(__dirname, 'lost_items_seed.json');
  const foundPath = path.resolve(__dirname, 'found_items_seed.json');

  const lostItems: SeedItem[] = JSON.parse(fs.readFileSync(lostPath, 'utf-8'));
  const foundItems: SeedItem[] = JSON.parse(fs.readFileSync(foundPath, 'utf-8'));

  console.log(`Loaded ${lostItems.length} lost items and ${foundItems.length} found items.\n`);

  const userId = await ensureTestUser();

  const insertedLost: string[] = [];
  const insertedFound: string[] = [];
  let lostSuccess = 0;
  let foundSuccess = 0;
  let lostFailed = 0;
  let foundFailed = 0;

  // Insert lost items
  for (let i = 0; i < lostItems.length; i++) {
    const item = lostItems[i];
    try {
      const id = await insertLostItem(userId, item);
      if (id) {
        insertedLost.push(id);
        lostSuccess++;
      } else {
        lostFailed++;
      }
    } catch (err) {
      lostFailed++;
      console.error(`  ✗ Failed to insert lost item ${i + 1}: ${(err as Error).message}`);
    }
    process.stdout.write(`\r  Inserted ${lostSuccess}/${lostItems.length} lost items, ${lostFailed} failed`);
  }
  process.stdout.write('\n');

  // Insert found items
  for (let i = 0; i < foundItems.length; i++) {
    const item = foundItems[i];
    try {
      const id = await insertFoundItem(userId, item);
      if (id) {
        insertedFound.push(id);
        foundSuccess++;
      } else {
        foundFailed++;
      }
    } catch (err) {
      foundFailed++;
      console.error(`  ✗ Failed to insert found item ${i + 1}: ${(err as Error).message}`);
    }
    process.stdout.write(`\r  Inserted ${foundSuccess}/${foundItems.length} found items, ${foundFailed} failed`);
  }
  process.stdout.write('\n\n');

  console.log(`Bulk insert complete: ${lostSuccess} lost, ${foundSuccess} found.\n`);

  // Run matching engine for each inserted lost item to generate/count matches
  let totalMatches = 0;
  if (insertedLost.length > 0 && insertedFound.length > 0) {
    console.log('Running matching engine to generate potential matches...');
    for (let i = 0; i < insertedLost.length; i++) {
      const lostId = insertedLost[i];
      try {
        const matches = await runMatchingEngine(lostId, 'lost');
        totalMatches += matches.length;
        process.stdout.write(`\r  Processed ${i + 1}/${insertedLost.length} lost items → ${totalMatches} matches so far`);
      } catch (err) {
        console.error(`\n  ✗ Matching engine failed for lost item ${lostId}: ${(err as Error).message}`);
      }
    }
    process.stdout.write('\n\n');
  }

  console.log(`Total matches generated: ${totalMatches}`);
  console.log('Bulk seed finished.');

  await pool.end();
}

seedBulk().catch((err) => {
  console.error('Bulk seed failed:', err);
  process.exit(1);
});
