import { queryOne } from '../db/pool.js';

async function main() {
  const userId = 'babf440d-e382-4498-adc7-4fd63b23fcaa';
  const email = 'thanikasalamgajanan@gmail.com';
  const fullName = 'Thanikasalam Gajanan';

  // Insert into auth.users first (required by foreign key)
  await queryOne(
    `INSERT INTO auth.users (id, email, raw_user_meta_data)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [userId, email, JSON.stringify({ full_name: fullName })]
  );

  // Also insert into public.users explicitly
  await queryOne(
    `INSERT INTO users (id, email, full_name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [userId, email, fullName, 'user']
  );

  console.log('User inserted successfully');
  process.exit(0);
}


main().catch((err) => {
  console.error('Failed to insert user:', err);
  process.exit(1);
});