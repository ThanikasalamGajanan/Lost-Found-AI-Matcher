-- Drop the FK from public.users to auth.users only in environments where
-- auth.users is empty (i.e., local development without Supabase Auth tables).
-- In production Supabase, auth.users is populated and the FK is preserved.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'users' AND constraint_name = 'users_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM auth.users LIMIT 1
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_id_fkey;
  END IF;
END $$;
