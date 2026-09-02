# Lost & Found AI Matcher — Deployment Guide

This guide deploys the Express backend to **Render** and the Next.js frontend to **Vercel**. No real secrets are committed to the repo; they are supplied through each platform's dashboard.

## What changed in the repo

- `render.yaml` — Render blueprint for the backend service.
- `frontend/vercel.json` — Vercel framework/build configuration.
- `backend/src/server.ts` — CORS now reads an optional `CORS_ORIGINS` env variable in addition to `FRONTEND_URL`.
- `backend/tsconfig.json` — One-off scripts `seedBulk.ts` and `e2eTest.ts` are excluded from the production build.

## Verified locally

Because the project folder name contains `&`, always quote the absolute path to the local executable when running builds:

```bash
# Backend build
'C:/Users/Cripto/Desktop/Lost-Found-AI-Matcher/Lost & Found-AI-Matcher/backend/node_modules/.bin/tsc' --noEmit
'C:/Users/Cripto/Desktop/Lost-Found-AI-Matcher/Lost & Found-AI-Matcher/backend/node_modules/.bin/tsc'

# Frontend build
'C:/Users/Cripto/Desktop/Lost-Found-AI-Matcher/Lost & Found-AI-Matcher/frontend/node_modules/.bin/next' build
```

Both builds pass cleanly.

## Prerequisites

- Render account
- Vercel account
- Supabase project with Auth + Postgres enabled
- OpenAI API key
- Resend account + verified sender domain/email

## 1. Supabase setup

1. Create or open your Supabase project.
2. Copy the **Project URL** and **anon public key** for the frontend.
3. Copy the **service-role key** for the backend (keep it secret).
4. Get the Postgres connection string:
   - Supabase Dashboard → Project → Settings → Database
   - Choose **Session pooler**
   - Copy the URI and replace `[YOUR-PASSWORD]` with your database password
5. Run the migrations in `supabase/migrations/` against that database (locally with `npm run migrate` from the `backend/` folder, or via Supabase SQL Editor).

> ✅ **Migrations resolved:** All three migrations (`001_initial_schema.sql`, `002_messages.sql`, and `003_admin_fraud_flag.sql`) are now recorded in `_migrations`.
>
> ⚠️ **Remaining issue:** Local `npm run migrate` still fails with `Connection terminated due to connection timeout` against every Supabase pooler URL/port tested. The current user does not have Supabase Dashboard access, and the logged-in Supabase CLI account lacks privileges for project `ncepomnxwpbrkkgimjog`. Since the migrations are applied, the next verification is to deploy to Render and confirm `/api/health` returns 200; Render may reach the pooler even though this local machine cannot.
>
> **Person B** (project owner or dashboard member) should:
> 1. Verify `_migrations` contains all three files:
>    ```sql
>    SELECT filename, applied_at FROM _migrations ORDER BY applied_at;
>    ```
> 2. Share the correct `DATABASE_URL` for `backend/.env` and Render.
>
> Full details are in `PERSON_B_HANDOFF.md`.

## 2. Deploy the backend to Render

1. In Render, create a new **Blueprint** and point it at this repo.
2. Render will read `render.yaml` and create the `lost-found-api` web service.
3. After the blueprint is created, go to the service's **Environment** tab and set the real values for every variable marked `sync: false`:
   - `SUPABASE_SERVICE_ROLE_KEY` — secret
   - `DATABASE_URL` — secret
   - `OPENAI_API_KEY` — secret
   - `RESEND_API_KEY` — secret
   - `JWT_SECRET` — generate a strong random string
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `EMAIL_FROM`
   - `NEXT_PUBLIC_API_URL`
   - `API_URL`
4. Update `FRONTEND_URL` and `CORS_ORIGINS` after you deploy the Vercel frontend (step 3). For example:
   - `FRONTEND_URL=https://lost-found.vercel.app`
   - `CORS_ORIGINS=https://lost-found.vercel.app,https://lost-found-git-main.vercel.app`
5. The service health check is `GET /api/health`.
6. Render build command: `npm install && npm run build`  
   Start command: `node dist/server.js`

## 3. Deploy the frontend to Vercel

1. In Vercel, import this repo.
2. Set the **Root Directory** to `frontend`.
3. Vercel should auto-detect **Next.js**. If not, set the framework to Next.js manually.
4. In the project settings, add these environment variables (replace placeholders with real values):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` — your Render backend URL, e.g. `https://lost-found-api.onrender.com/api`
5. Deploy. Vercel will run `next build`.
6. Copy the production Vercel URL and paste it into the Render backend env vars (`FRONTEND_URL` and `CORS_ORIGINS`), then redeploy the backend so CORS allows the frontend.

## 4. Post-deploy checks

- `GET https://<backend>/api/health` should return `{ "status": "ok" }`.
- Sign up a test user from the deployed frontend and confirm the backend receives the request.
- Verify emails are sent by checking Resend logs.

## Security reminders

- Never commit `.env`, `frontend/.env.local`, or any file containing real keys.
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `OPENAI_API_KEY`, `RESEND_API_KEY`, and `JWT_SECRET` must be set as encrypted secrets in Render and/or Vercel.
- The existing `.gitignore` already excludes `.env`, `.env.local`, and `.env.production`.
