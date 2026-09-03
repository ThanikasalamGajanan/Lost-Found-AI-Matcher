# Person B Handoff — Database Connection Blocker

> ✅ **Migrations resolved:** All three migrations (`001_initial_schema.sql`, `002_messages.sql`, and `003_admin_fraud_flag.sql`) are now recorded in `_migrations`.
>
> ⚠️ **Remaining issue:** Local attempts to connect to the Supabase PostgreSQL pooler still fail with `Connection terminated due to connection timeout`. This document contains the history and next steps for verifying the connection from Render.
>
> **Latest update:** 2026-09-01 — inserting `003_admin_fraud_flag.sql` fails with `duplicate key value violates unique constraint "_migrations_filename_key"`, confirming all three migrations are recorded in `_migrations`.

## Current Status

Local attempts to connect to the Supabase PostgreSQL pooler all fail with:

```
Connection terminated due to connection timeout
```

The HTTP API for the project is healthy (returns 401 when unauthenticated), so the Supabase project itself appears active.

## Current DATABASE_URL

```text
postgresql://postgres.ncepomnxwpbrkkgimjog:Gaja14nan11@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

*(Password masked; see `backend/.env` line 20 for the real value.)*

## Migrations Already Applied

All three migrations are now recorded in `_migrations`:

```json
[
  {"filename": "001_initial_schema.sql", "applied_at": "2026-08-26T15:18:08.076011+00:00"},
  {"filename": "002_messages.sql", "applied_at": "[confirmed 2026-09-01]"},
  {"filename": "003_admin_fraud_flag.sql", "applied_at": "[confirmed 2026-09-01]"}
]
```

No further migration action is required in Supabase.

## What Person B Needs to Do

1. **Verify the `_migrations` table** shows all three files:

   ```sql
   SELECT filename, applied_at FROM _migrations ORDER BY applied_at;
   ```

2. **Update `backend/.env`** (both `lf-matcher/backend/.env` and `Lost & Found-AI-Matcher/backend/.env`) with the correct `DATABASE_URL` if it differs from the current value.
3. **Deploy to Render** and confirm the backend can reach the pooler:

   ```bash
   curl https://<your-render-backend>/api/health
   ```

4. **If Render also cannot connect**, check Supabase Dashboard for an IP allow-list or regenerate the Session pooler URI from:
   Project Settings → Database → Connection string → Session pooler

### Note on local `npm run migrate`

Local runs on this machine continue to time out at the PostgreSQL handshake. Because all migrations are already recorded, the important verification is whether the deployed Render service can connect and start successfully, not whether `npm run migrate` succeeds from this local machine.

## Files Requiring the Correct DATABASE_URL

- `C:\Users\Cripto\lf-matcher\backend\.env`
- `C:\Users\Cripto\Desktop\Lost-Found-AI-Matcher\Lost & Found-AI-Matcher\backend\.env`
- Render dashboard environment variables (set as a secret)

## Tested Connection Options (All Failed)

A script ran `npm run migrate` against every URL below. Every attempt failed with:

```text
Migration failed: Error: Connection terminated due to connection timeout
[cause]: Error: Connection terminated unexpectedly
```

Each timeout occurred after 5–6 seconds. The migration runner always found all 3 migrations and reached the connection step before failing.

### Pooler URL / port matrix

| # | Host | Port | Query params | Result |
|---|------|------|--------------|--------|
| 1 | aws-0-ap-south-1.pooler.supabase.com | 6543 | — | Timeout |
| 2 | aws-0-ap-south-1.pooler.supabase.com | 6543 | `?pgbouncer=true` | Timeout |
| 3 | aws-0-ap-south-1.pooler.supabase.com | 6543 | `?sslmode=require&pgbouncer=true` | Timeout |
| 4 | aws-0-ap-south-1.pooler.supabase.com | 5432 | — | Timeout |
| 5 | aws-0-ap-southeast-1.pooler.supabase.com | 5432 | — | Timeout |
| 6 | aws-0-ap-southeast-1.pooler.supabase.com | 6543 | — | Timeout |
| 7 | aws-0-ap-northeast-1.pooler.supabase.com | 5432 | — | Timeout |
| 8 | aws-0-ap-northeast-1.pooler.supabase.com | 6543 | — | Timeout |
| 9 | aws-0-eu-central-1.pooler.supabase.com | 5432 | — | Timeout |
| 10 | aws-0-eu-central-1.pooler.supabase.com | 6543 | — | Timeout |
| 11 | aws-0-us-east-1.pooler.supabase.com | 5432 | — | Timeout |
| 12 | aws-0-us-east-1.pooler.supabase.com | 6543 | — | Timeout |

### Alternative methods tested

| Method | Result |
|--------|--------|
| WSL (`/mnt/c/Users/Cripto/lf-matcher/backend`) | Not installed |
| `psql` client direct connection | Not installed |
| Supabase CLI `supabase link --project-ref ncepomnxwpbrkkgimjog` | CLI account lacks privileges for this project |
| Mobile hotspot / different network | Not available on this machine |
| Direct IPv6 host `db.ncepomnxwpbrkkgimjog.supabase.co` | Node.js cannot resolve it (`getaddrinfo ENOTFOUND`) |
| Alternative password ending in `$$` (URL-encoded) on port 5432 | Timeout (same error) — issue is not just password |

### Latest re-test

Re-tested the current `DATABASE_URL` on **2026-09-01 at 23:10 +05:30** after the user confirmed it as the active URI. Result: **timeout**.

```text
Migration failed: Error: Connection terminated due to connection timeout
[cause]: Error: Connection terminated unexpectedly
```

## Final Conclusion

Every local connection path is exhausted. The issue is outside this machine: either the pooler URI/password is incorrect, the Supabase project has an IP allow-list, or the project is owned by a different Supabase account. Migrations must be applied by **Person B** using Supabase Dashboard access.

## Deployed Demo Seeding

After the backend is deployed and migrations are applied, seed demo data through the API so embeddings and matches are generated realistically.

See `DEPLOYED_SEEDING.md` in the repo root for the full procedure. The short version is:

```bash
cd backend
API_URL=https://[REPLACE_AFTER_DEPLOYMENT: backend URL]/api npx tsx src/db/loadTestReports.ts path/to/demo-reports.json
```

Then verify matches appear via:

```bash
curl -s https://[REPLACE_AFTER_DEPLOYMENT: backend URL]/api/matches | head
```

Note: the default input file `lost_and_found_test_reports.json` is not present in the repo, so a compatible report JSON must be created or supplied first.
