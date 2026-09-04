import { query } from '../db/pool.js';

async function main() {
  const columns = await query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'auth' AND table_name = 'users'
     ORDER BY ordinal_position`
  );
  console.log(JSON.stringify(columns, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});