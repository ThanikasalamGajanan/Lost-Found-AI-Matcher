# Final Handoff — Deploy Lost & Found AI Matcher

> **Date:** 2026-09-02
> **From:** Current session operator
> **To:** Person B (team member with GitHub + Supabase + Render + Vercel access)
>
> The local machine cannot connect to the Supabase pooler during the PostgreSQL handshake. TCP ports 5432/6543 are reachable, but every `npm run migrate` attempt times out. Person B confirmed the same `DATABASE_URL` works on their network, so the issue is local to this Windows environment. The only path to a live submission is to deploy the backend to **Render** and the frontend to **Vercel**.

---

## 1. Current Repository State

- **Local branch:** `Admin`
- **Remote:** `https://github.com/ThanikasalamGajanan/Lost-Found-AI-Matcher.git`
- **Uncommitted changes:** README, backend source files, frontend source files, and new docs (`SUBMISSION.md`, `DEPLOYMENT.md`, `PERSON_B_HANDOFF.md`, `DEMO_SCRIPT.md`, `DEPLOYED_SEEDING.md`, `pre-submission-health-check.md`, `render.yaml`, `frontend/vercel.json`, etc.)
- **Migration status:** All three migrations (`001_initial_schema.sql`, `002_messages.sql`, `003_admin_fraud_flag.sql`) are recorded in Supabase `_migrations`.
- **Build status:** Backend `tsc`, frontend `next build`, and backend `vitest` all pass locally.

---

## 2. What Person B Needs to Do

### 2.1 Push current code to GitHub

From the junction path (avoids the `&` character issue):

```powershell
cd C:\Users\Cripto\lf-matcher

# Optional: stash or review changes first
git status

# Add and commit all work
git add -A
git commit -m "Prepare submission docs, deployment config, and migration records"

# Push the Admin branch
git push origin Admin
```

If `main` is the target branch, open a pull request from `Admin` → `main` and merge it, or run:

```powershell
git checkout main
git merge Admin
git push origin main
```

---

### 2.2 Deploy the backend to Render

1. Go to **https://dashboard.render.com**
2. Create a new **Blueprint** and connect the GitHub repo `ThanikasalamGajanan/Lost-Found-AI-Matcher`.
3. Render will read `render.yaml` and create the `lost-found-api` web service.
4. In Render dashboard, set these environment variables as secrets (do NOT commit them):

   | Variable | Value / Source |
   |----------|----------------|
   | `DATABASE_URL` | `postgresql://postgres.ncepomnxwpbrkkgimjog:Gaja14nan11@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` secret |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` public key |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://ncepomnxwpbrkkgimjog.supabase.co` |
   | `OPENAI_API_KEY` | OpenAI dashboard API key |
   | `RESEND_API_KEY` | Resend dashboard API key |
   | `EMAIL_FROM` | Sender email verified in Resend, e.g. `fathimanafla4932@gmail.com` |
   | `JWT_SECRET` | A strong random string (already set in current `.env`) |
   | `FRONTEND_URL` | Live Vercel URL, e.g. `https://lost-found-ai-matcher.vercel.app` |
   | `CORS_ORIGINS` | Same as `FRONTEND_URL` |
   | `API_URL` | Render backend URL, e.g. `https://lost-found-api.onrender.com` |
   | `NEXT_PUBLIC_API_URL` | Same as `API_URL` + `/api`, e.g. `https://lost-found-api.onrender.com/api` |

5. Wait for the build and deploy to complete.
6. Test the health endpoint:

   ```bash
   curl https://<render-backend-url>/api/health
   ```

   Expected: `200 OK`.

---

### 2.3 Deploy the frontend to Vercel

1. Go to **https://vercel.com/dashboard**
2. Import the GitHub repo `ThanikasalamGajanan/Lost-Found-AI-Matcher`.
3. Set the **root directory** to `frontend`.
4. Set these environment variables in Vercel project settings:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://ncepomnxwpbrkkgimjog.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
   | `NEXT_PUBLIC_API_URL` | `https://<render-backend-url>/api` |

5. Deploy and wait for the build to complete.
6. Copy the live Vercel URL (e.g. `https://lost-found-ai-matcher.vercel.app`).

---

### 2.4 Update live URLs in project files

After both deployments are live, replace placeholders in:

- `SUBMISSION.md`
  - Frontend URL
  - Backend URL
  - API health URL
  - Demo video link
  - Repository URL
  - Resend sender domain
  - Team member names
- `render.yaml`
  - `FRONTEND_URL`
  - `CORS_ORIGINS`
- `frontend/vercel.json`
  - `NEXT_PUBLIC_API_URL`
- `backend/.env`
  - `FRONTEND_URL`

---

## 3. Environment Variables Reference

### backend/.env (production values)

```env
NODE_ENV=production
PORT=4000

NEXT_PUBLIC_SUPABASE_URL=https://ncepomnxwpbrkkgimjog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>

DATABASE_URL=postgresql://postgres.ncepomnxwpbrkkgimjog:Gaja14nan11@aws-0-ap-south-1.pooler.supabase.com:5432/postgres

OPENAI_API_KEY=<OpenAI API key>
RESEND_API_KEY=<Resend API key>
EMAIL_FROM=<verified sender email>
JWT_SECRET=<strong random string>

FRONTEND_URL=https://<vercel-frontend-url>
API_URL=https://<render-backend-url>
NEXT_PUBLIC_API_URL=https://<render-backend-url>/api
```

### frontend/.env.local / Vercel env

```env
NEXT_PUBLIC_SUPABASE_URL=https://ncepomnxwpbrkkgimjog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon key>
NEXT_PUBLIC_API_URL=https://<render-backend-url>/api
```

---

## 4. Verification Checklist

- [ ] Code pushed to GitHub (`main` or `Admin` branch)
- [ ] Render service `lost-found-api` deployed and `/api/health` returns 200
- [ ] Vercel frontend deployed and reachable
- [ ] Frontend can call backend API (check browser network tab)
- [ ] User can sign up, report lost/found items, and see matches
- [ ] Admin dashboard accessible with an admin user
- [ ] Demo video recorded and uploaded
- [ ] `SUBMISSION.md` updated with all live URLs and team names

---

## 5. If Render Cannot Connect to Supabase

1. In Supabase Dashboard, go to Project Settings → Database → Connection string.
2. Choose **Session pooler** and copy the URI.
3. Replace the password in the URI and update Render's `DATABASE_URL`.
4. Check for any IP allow-list or network restriction in Supabase Dashboard.
5. Restart the Render service.

---

## 6. Notes for the Team

- All migrations are already applied in Supabase. Do not run `npm run migrate` locally unless the local connection issue is fixed.
- The local timeout is not a blocker for production deployment.
- Full local connection diagnosis is in `PERSON_B_HANDOFF.md`.
- Demo seeding procedure for the deployed backend is in `DEPLOYED_SEEDING.md`.
