import { pool } from './pool.js';
import { supabaseAdmin } from './supabase.js';

async function seed(): Promise<void> {
  console.log('Seeding database...');

  const testEmail = 'admin@test.com';
  const testPassword = 'TestPassword123!';

  // Find or create the test admin user in Supabase Auth using the service role key.
  let testUserId: string;

  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`);
  }

  const existingUser = listData.users.find((u) => u.email === testEmail);

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

  // Ensure the public.users row exists and has the admin role.
  // The on_auth_user_created trigger usually creates this row automatically,
  // but we upsert to make the seed idempotent and to set role = 'admin'.
  await pool.query(
    `INSERT INTO users (id, email, full_name, role)
     VALUES ($1, $2, 'Admin User', 'admin')
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role`,
    [testUserId, testEmail]
  );
  console.log('Ensured admin user row in public.users');

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
