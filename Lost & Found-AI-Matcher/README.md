# Lost & Found AI Matcher

A privacy-first, AI-powered lost-and-found platform built for university campuses. It matches lost reports with found reports using a weighted, explainable score, then verifies claimants through category-specific questions before exposing private contact details.

---

## Problem

On a typical campus, lost items are posted across WhatsApp groups, noticeboards, and disconnected Facebook pages. Owners rarely find their items, finders sit on unclaimed property, and valuable goods are handed over to the wrong people because there is no trustworthy way to prove ownership.

## Solution

Lost & Found AI Matcher centralises reporting, ranks possible matches with an AI scoring model, and protects both parties with a verification workflow:

1. **Report** – File a lost or found item with photos, location, time, and structured details.
2. **Match** – The backend computes a weighted similarity score across description, image, location, time, and attributes.
3. **Verify** – The finder’s hidden `private_details` generate a question only the real owner is likely to answer. OpenAI judges the answer automatically.
4. **Connect** – After a correct answer (or admin approval of a dispute), the owner’s contact info and the finder’s identifying details are unlocked.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                    │
│  Public Pages  │  Report Forms  │  Matches  │  Admin Panel  │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────┐
│                  Backend (Node.js / Express)                 │
│  Auth  │  Reports  │  Matching Engine  │  Verification  │  Admin │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌────────────┬────────────▼────────────┬──────────────────────┐
│  Supabase  │  PostgreSQL (pgvector)  │  Supabase Storage    │
│   (Auth)   │  (Items + Matches)      │  (Photos)            │
└────────────┴─────────────────────────┴──────────────────────┘
```

- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS.
- **Backend**: Express.js with TypeScript; OpenAI for embeddings, vision comparison, and LLM grading.
- **Database**: Supabase PostgreSQL with `pgvector` for 1,536-dimension description embeddings.
- **Storage**: Supabase Storage for item photos.
- **Email**: Resend for match and verification notifications.
- **Deployment**: Vercel (frontend) + Render (backend) via `render.yaml` and `frontend/vercel.json`.

---

## Matching Score Formula

Each candidate match receives a weighted score from 0 to 100. Matches below the 40-point threshold are filtered out.

| Factor                  | Weight | Method                                              |
|-------------------------|--------|-----------------------------------------------------|
| Description similarity  | 30%    | OpenAI `text-embedding-3-small` cosine similarity   |
| Image similarity        | 25%    | OpenAI vision model feature comparison              |
| Location proximity      | 20%    | Haversine distance with exponential decay           |
| Time proximity          | 15%    | Temporal decay based on lost/found timestamps       |
| Brand/Colour/Category   | 10%    | Exact and fuzzy string matching on structured fields|

```
total_score =
  0.30 * desc_score +
  0.25 * image_score +
  0.20 * location_score +
  0.15 * time_score +
  0.10 * attr_score
```

Every match card in the UI shows the full breakdown so users understand why a pairing was suggested.

---

## Verification Flow

```
Report filed → Match found → Question generated from private_details
       ↓
Owner answers → Correct → Contact info unlocked + message thread opened
            → Incorrect → Retry (max 3) → Escalated to admin review
```

1. When a found report is submitted, the finder provides **private_details** that are not shown publicly.
2. The backend turns one private detail into a natural-language question.
3. The lost-item owner answers the question.
4. OpenAI compares the answer to the stored fact and returns `correct`, `incorrect`, or `escalated`.
5. On a correct answer, both parties can see each other’s contact information and start an in-app message thread.
6. After exhausting retries or on conflicting evidence, the match moves to `disputed` and an admin reviews the attempt history.

---

## Privacy Design

Private information is split into two hidden fields:

- `lost_items.identifying_info` – serial numbers, engravings, or other owner-specific marks.
- `found_items.private_details` – category-specific verification facts used to generate questions.

Neither field is exposed in public listings or to the other party until verification succeeds. Verification questions are designed to be easy for the real owner but hard for a random claimant, using details a finder can observe but others cannot guess. Examples by category:

- **Keys**: keychain colour, number of keys, tag text, room/locker number.
- **Electronics**: lock-screen wallpaper, case colour/sticker, exact brand/model, attached accessory.
- **Bag**: bag colour, brand/logo, visible contents, unique zipper/patch detail.
- **Wallet**: wallet colour, ID card type, note count/denomination, photo inside.
- **Jewellery**: jewellery type, metal/colour, engraving/initial, charm shape.
- **Clothing**: clothing type, colour/pattern, brand/size label, unique mark.
- **Document**: document type, owner name, course/subject code, institution name.
- **Umbrella**: umbrella colour, pattern/brand, handle type, size/ribs.
- **Bottle**: bottle colour, brand/sticker, liquid inside, cap colour/strap.
- **Glasses**: frame colour, frame shape, brand on arm, case colour.
- **Other**: unique detail, owner-identifying mark, location-only hint.

Sensitive data such as full NIC numbers, passwords, or bank details are never used as verification questions.

---

## Admin Features

The admin dashboard gives moderators oversight without exposing private data prematurely:

- **Dashboard stats** – counts of active, matched, verified, returned, and closed items plus pending disputes.
- **Pending matches** – review all matches awaiting judgment and approve or reject them.
- **Dispute review** – inspect verification attempt history, including questions, answers, and AI judgments, then rule on escalated cases.
- **Item status management** – update an item’s status through its lifecycle (`active` → `matched` → `verified` → `returned`/`closed`).
- **Fraud awareness** – repeated incorrect attempts are surfaced for moderator attention.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Supabase project with the `pgvector` extension enabled
- OpenAI API key
- Resend API key (for notifications)

### Local Setup

```bash
# 1. Clone and install dependencies for both packages
git clone <repo-url>
cd "Lost & Found-AI-Matcher"
npm run install:all

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase, OpenAI, and Resend credentials

# 3. Run database migrations
npm run db:migrate

# 4. Start the development servers (two terminals)
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:3000
```

### Deployment

Production deployment is configured out of the box:

- **Backend**: `render.yaml` at the repository root defines the Render service, health check, and required environment variables.
- **Frontend**: `frontend/vercel.json` configures the Vercel Next.js build.

See `DEPLOYMENT.md` for the full step-by-step production guide.

---

## Database Migrations — Resolved

> Last verified: **2026-09-01**

All three migrations are now recorded in `_migrations`:

- `001_initial_schema.sql`
- `002_messages.sql`
- `003_admin_fraud_flag.sql`

This was confirmed when inserting `003_admin_fraud_flag.sql` failed with `duplicate key value violates unique constraint "_migrations_filename_key"`, proving it already exists.

Local attempts to run `npm run db:migrate` still fail on this machine with `Connection terminated due to connection timeout`, but every pooler URL/port option has been exhausted. Since the migrations are applied, the next verification is to deploy to Render and confirm `/api/health` returns 200. Render may reach the pooler even though this local machine cannot.

Full details, including every tested URL/port and exact errors, are in `PERSON_B_HANDOFF.md`.

---

## Team Roles

- **Person A** – Frontend & User Flows (Next.js, forms, match results, messaging)
- **Person B** – Backend & AI Matching Engine (Express, LLM, scoring algorithm)
- **Person C** – Admin Dashboard, Security, Deployment & Testing

## License

MIT
