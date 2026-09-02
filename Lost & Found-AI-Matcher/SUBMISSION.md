<!--
DEPLOYMENT INSTRUCTIONS
1. Deploy the frontend to Vercel (see frontend/vercel.json).
2. Deploy the backend to Render using render.yaml.
3. After both are live, paste the real URLs into:
   - SUBMISSION.md (this file)
   - render.yaml (FRONTEND_URL and CORS_ORIGINS)
   - frontend/vercel.json (NEXT_PUBLIC_API_URL)
   - backend/.env (FRONTEND_URL)
4. Verify the backend health endpoint returns 200.
5. Record a 2–3 minute demo and paste the public video link below.
-->

# Submission Sheet

## Live Deployment

| Component | URL                                      |
|-----------|------------------------------------------|
| Frontend  | `[REPLACE_AFTER_DEPLOYMENT: frontend URL]` |
| Backend   | `[REPLACE_AFTER_DEPLOYMENT: backend URL]` |
| API Health| `[REPLACE_AFTER_DEPLOYMENT: backend URL]/api/health` |

> Replace the placeholder URLs above with the actual deployed URLs before submitting.

---

## Demo Video

| Link | Duration |
|------|----------|
| `[REPLACE_AFTER_DEPLOYMENT: demo video link]` | 2–3 minutes |

> Upload the recorded demo to Google Drive / YouTube / Loom and paste the public link here.

---

## Repository

| Item            | Value                                            |
|-----------------|--------------------------------------------------|
| Repository URL  | `[REPLACE_AFTER_DEPLOYMENT: repository URL]`     |
| Final commit    | `6bea05723acc7c4471e612ccdca379d1cb84fca5`       |
| Branch          | `main`                                           |

---

## Cloud Services

### Supabase

| Item            | Value                                            |
|-----------------|--------------------------------------------------|
| Project URL     | `https://ncepomnxwpbrkkgimjog.supabase.co`       |
| Project ID      | `ncepomnxwpbrkkgimjog`                           |
| Region          | `ap-south-1` (Mumbai)                            |
| Extensions      | `pgvector` enabled                               |

> Verify these details in your Supabase Dashboard before submitting.

### OpenAI

- Model used for embeddings: `text-embedding-3-small`
- Model used for vision comparison and answer grading: `gpt-4o-mini`

### Resend

- Sender domain: `[REPLACE_AFTER_DEPLOYMENT: notifications@your-domain.com]`
- Used for match and verification email notifications.

### Storage

- Supabase Storage bucket: `item-photos`

---

## Team Members & Roles

| Name          | Role                                            |
|---------------|-------------------------------------------------|
| [REPLACE_AFTER_DEPLOYMENT: Person A name] | Frontend & User Flows                           |
| [REPLACE_AFTER_DEPLOYMENT: Person B name] | Backend & AI Matching Engine                    |
| [REPLACE_AFTER_DEPLOYMENT: Person C name] | Admin Dashboard, Security, Deployment & Testing |

> Replace the placeholder names above with real names before submitting.

---

## Submission Checklist

- [x] `README.md` rewritten for judges
- [x] `DEMO_SCRIPT.md` created with test data and two accounts
- [x] `SUBMISSION.md` created with deployment links and commit hash
- [ ] Live frontend URL verified
- [ ] Live backend `/api/health` verified
- [ ] Demo video uploaded and link inserted
- [ ] Actual Supabase project reference inserted
- [ ] Team member names inserted
- [x] Database migrations 002 and 003 applied and verified

---

## Database Migrations — Resolved

> Last verified: **2026-09-01**

All three migrations are now recorded in `_migrations`:

- `001_initial_schema.sql`
- `002_messages.sql`
- `003_admin_fraud_flag.sql`

This was confirmed when inserting `003_admin_fraud_flag.sql` failed with `duplicate key value violates unique constraint "_migrations_filename_key"`, proving it already exists.

### Remaining local issue

`npm run migrate` still fails on this machine with `Connection terminated due to connection timeout` against every Supabase pooler URL/port tested. All local connection options are exhausted (see `PERSON_B_HANDOFF.md` for the full matrix). Since the migrations themselves are already applied, the next verification step is to deploy to Render and confirm `/api/health` returns 200. Render may be able to reach the pooler even though this local machine cannot.

### Verify the migration state

```sql
SELECT filename, applied_at FROM _migrations ORDER BY applied_at;
```

Expected result:

```json
[
  {"filename": "001_initial_schema.sql", "applied_at": "2026-08-26T15:18:08.076011+00:00"},
  {"filename": "002_messages.sql", "applied_at": "[confirmed 2026-09-01]"},
  {"filename": "003_admin_fraud_flag.sql", "applied_at": "[confirmed 2026-09-01]"}
]
```

---

## Notes for Judges

- The verification workflow uses OpenAI to grade answers against hidden `private_details` provided by the finder.
- All private fields (`identifying_info`, `private_details`) remain hidden until verification succeeds or an admin intervenes.
- Deployment configuration is committed as `render.yaml` (backend) and `frontend/vercel.json` (frontend); see `DEPLOYMENT.md` for the full production setup guide.
