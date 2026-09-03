# Deployed Demo Seeding Guide

This document explains how to populate the deployed Lost & Found AI Matcher database with demo reports so the matching flow can be verified end-to-end.

## Recommended Script

Use `backend/src/db/loadTestReports.ts`. It posts lost/found reports through the public API exactly like a real user, which means it exercises:

- Authentication
- Joi validation
- OpenAI embedding generation
- The matching pipeline

The script accepts an `API_URL` override, so it works against a deployed backend without code changes.

## Prerequisites

1. The backend is deployed and reachable (e.g. `https://lost-found-api.onrender.com`).
2. The backend environment has a working `DATABASE_URL` and all migrations (`001_initial_schema.sql`, `002_messages.sql`, `003_admin_fraud_flag.sql`) are recorded in `_migrations`.
3. `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `JWT_SECRET` are set in the environment where you run the script.
4. A JSON file containing demo reports in the format expected by the script (see below).

## Demo JSON Format

`loadTestReports.ts` expects a JSON file with this shape:

```json
{
  "dataset": { "name": "Demo Reports", "record_count": 30 },
  "ground_truth": {
    "matched_pairs": [
      { "match_id": "M01", "lost_report_id": "L-001", "found_report_id": "F-001" }
    ],
    "distractors": []
  },
  "reports": [
    {
      "report_id": "L-001",
      "type": "lost",
      "language": "en",
      "category": "bag",
      "brand": "Lenovo",
      "colour": "black",
      "location": "Colombo Fort Railway Station",
      "date": "2026-08-12",
      "time": "08:30",
      "description": "Lenovo laptop backpack with a torn front zip pocket",
      "match_id": null
    },
    {
      "report_id": "F-001",
      "type": "found",
      "language": "en",
      "category": "bag",
      "brand": null,
      "colour": "dark grey",
      "location": "Colombo Fort Railway Station",
      "date": "2026-08-12",
      "time": "09:45",
      "description": "Heavy dark backpack left near the ticket counter",
      "match_id": null
    }
  ]
}
```

## Run the Seed Script

From the `backend` directory:

```bash
# On the machine that has the repo cloned
cd backend

# Windows (single-quoted path because the repo path contains '&')
API_URL=https://[REPLACE_AFTER_DEPLOYMENT: backend URL]/api npx tsx src/db/loadTestReports.ts path/to/demo-reports.json

# macOS / Linux
API_URL=https://[REPLACE_AFTER_DEPLOYMENT: backend URL]/api npx tsx src/db/loadTestReports.ts path/to/demo-reports.json
```

> Replace `[REPLACE_AFTER_DEPLOYMENT: backend URL]` with the actual Render URL, e.g. `https://lost-found-api-xyz.onrender.com`.

The script will:

1. Create a test user (`seed@test.com` / `SeedTest1234!`) in Supabase Auth if it does not exist.
2. Submit each report to `/api/reports/lost` or `/api/reports/found`.
3. Write a `report_id_mapping.json` file next to the input JSON with the generated database IDs.

## Current Repo Status

The default input file `lost_and_found_test_reports.json` is **not present** in the repo root. The repo does contain:

- `backend/src/db/matcher_ground_truth_db1520ca.json` — an answer key with match metadata, not report records.
- `backend/src/db/lost_items_seed.json` and `backend/src/db/found_items_seed.json` — direct database insert records for `backend/src/db/seed.ts`.

Before running `loadTestReports.ts`, create or obtain a report JSON file in the format shown above.

## Alternative: Direct Database Seeding

If you prefer to seed directly via SQL/Node (requires a working `DATABASE_URL`):

```bash
# Inserts the sample lost/found rows from the JSON seed files
cd backend
npx tsx src/db/seed.ts
```

This uses `backend/src/db/lost_items_seed.json` and `backend/src/db/found_items_seed.json` and creates an admin user (`admin@test.com` / `TestPassword123!`). It does **not** generate embeddings or run through the API, so matching quality may differ from reports submitted via the API path.

## Verify the Seed Worked

1. Check that reports exist:

   ```bash
   curl -s https://[REPLACE_AFTER_DEPLOYMENT: backend URL]/api/reports | head
   ```

2. Check that matches were generated:

   ```bash
   curl -s https://[REPLACE_AFTER_DEPLOYMENT: backend URL]/api/matches | head
   ```

3. Log into the deployed frontend, open the matches page, and confirm cards appear with status labels (pending, verified, disputed, returned).
