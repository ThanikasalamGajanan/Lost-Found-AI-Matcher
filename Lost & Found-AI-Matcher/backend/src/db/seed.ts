import { pool } from './pool.js';

async function seed(): Promise<void> {
  console.log('Seeding database...');

  // Create a test admin user (you need to first create this user in Supabase Auth)
  // For local development, use the signup endpoint first, then update role manually:
  // UPDATE users SET role = 'admin' WHERE email = 'admin@test.com';

  const testUserId = '00000000-0000-0000-0000-000000000001';

  // Insert test user (only works if this ID exists in auth.users)
  try {
    await pool.query(
      `INSERT INTO users (id, email, full_name, role)
       VALUES ($1, 'admin@test.com', 'Admin User', 'admin')
       ON CONFLICT (id) DO NOTHING`,
      [testUserId]
    );
  } catch {
    console.log('Skipping user seed (auth.users entry needed first).');
  }

  // Sample lost item
  await pool.query(
    `INSERT INTO lost_items (user_id, category, brand, colour, description, location, latitude, longitude, lost_at)
     VALUES ($1, 'keys', 'Toyota', 'silver', 'Silver Toyota car keys with a small leather keychain and a gym membership tag', 'Colombo Fort Railway Station', 6.9355, 79.8487, '2024-12-15T08:30:00Z')
     ON CONFLICT DO NOTHING`,
    [testUserId]
  );

  // Sample found item
  await pool.query(
    `INSERT INTO found_items (user_id, category, brand, colour, description, location, latitude, longitude, found_at, private_details)
     VALUES ($1, 'keys', 'Toyota', 'silver', 'Found a set of car keys near the ticket counter. Has a keychain and some tags attached.', 'Colombo Fort Railway Station', 6.9356, 79.8490, '2024-12-15T09:15:00Z', '{"keychain_material": "leather", "gym_tag": "yes", "number_of_keys": "3"}')
     ON CONFLICT DO NOTHING`,
    [testUserId]
  );

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
