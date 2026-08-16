# Lost & Found AI Matcher

An intelligent lost-and-found platform that uses AI to match lost items with found items through weighted scoring (description embeddings, image similarity, location, time, and structured attributes). Includes a verification workflow to protect privacy and prevent false claims.

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

## Tech Stack

| Layer      | Technology                                  |
|------------|---------------------------------------------|
| Frontend   | Next.js 14, React 18, TypeScript, Tailwind  |
| Backend    | Node.js, Express, TypeScript                |
| Database   | PostgreSQL via Supabase (pgvector enabled)  |
| Auth       | Supabase Auth                               |
| AI/ML      | OpenAI (embeddings, vision, chat)           |
| Storage    | Supabase Storage (item photos)              |
| Email      | Resend                                      |
| Deployment | Vercel (frontend) + Render (backend)        |

## Matching Algorithm — Weighted Scoring

| Factor                  | Weight | Method                            |
|-------------------------|--------|-----------------------------------|
| Description similarity  | 30%    | OpenAI embeddings cosine distance |
| Image similarity        | 25%    | Vision model feature comparison   |
| Location proximity      | 20%    | Haversine formula + decay         |
| Time proximity          | 15%    | Temporal decay function           |
| Brand/Colour/Category   | 10%    | Exact + fuzzy matching            |

## Verification Flow

```
Report filed → Match found → Question generated from private fields
       ↓
Owner answers question → Correct → Contact info unlocked
                       → Incorrect → Retry (max 3) → Escalate to admin
```

## Project Structure

```
Lost & Found-AI-Matcher/
├── frontend/              # Next.js 14 frontend
│   ├── app/               # App router pages
│   ├── components/        # Reusable UI components
│   ├── lib/               # API client, Supabase, utils
│   ├── hooks/             # Custom React hooks
│   ├── context/           # React context providers
│   └── types/             # TypeScript type definitions
├── backend/               # Express.js backend
│   ├── src/
│   │   ├── routes/        # API route definitions
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic (matching, LLM)
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── db/            # Database schema + migrations
│   │   └── utils/         # Helpers and utilities
│   └── tests/             # Backend tests
└── supabase/
    └── migrations/        # SQL migration files
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- OpenAI API key
- Resend API key (for email notifications)

### Setup

```bash
# 1. Clone and install dependencies for both packages
git clone <repo-url>
cd "Lost & Found-AI-Matcher"
npm run install:all

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase, OpenAI, and Resend keys

# 3. Run database migrations
npm run db:migrate

# 4. Start development servers (open TWO terminals)
# Terminal 1 — backend:
npm run dev:backend
# Terminal 2 — frontend:
npm run dev:frontend
```

Frontend runs at **http://localhost:3000**  
Backend runs at **http://localhost:4000**

## API Endpoints

### Reports

| Method | Endpoint                     | Description              |
|--------|------------------------------|--------------------------|
| POST   | `/api/reports/lost`          | Create lost item report  |
| POST   | `/api/reports/found`         | Create found item report |
| GET    | `/api/reports/:id`           | Get report by ID         |
| GET    | `/api/reports/user/:userId`  | Get user's reports       |

### Matching

| Method | Endpoint                     | Description              |
|--------|------------------------------|--------------------------|
| GET    | `/api/matches/:reportId`     | Get matches for a report |
| POST   | `/api/matches/run/:reportId` | Trigger matching engine  |

### Verification

| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | `/api/verify/:matchId/question`   | Get verification question|
| POST   | `/api/verify/:matchId/answer`     | Submit answer            |
| POST   | `/api/verify/:matchId/judge`      | Judge answer (finder)    |

### Admin

| Method | Endpoint                      | Description              |
|--------|-------------------------------|--------------------------|
| GET    | `/api/admin/stats`            | Dashboard statistics     |
| GET    | `/api/admin/matches`          | All pending matches      |
| POST   | `/api/admin/matches/:id/approve` | Approve a match       |
| POST   | `/api/admin/matches/:id/reject`  | Reject a match        |
| PATCH  | `/api/admin/items/:id/status`    | Update item status    |

## Deployment

### Frontend (Vercel)

```bash
cd frontend
npx vercel --prod
```

### Backend (Render)

Create a new Web Service on Render, point to the `backend/` directory, and set environment variables from `.env.example`.

### Database (Supabase)

1. Create a Supabase project
2. Enable the `pgvector` extension
3. Run migrations: `npm run db:migrate`

## Team Roles

- **Person A** — Frontend & User Flows (Next.js, forms, match results, chat)
- **Person B** — Backend & AI Matching Engine (Express, LLM, scoring algorithm)
- **Person C** — Admin Dashboard, Security, Deployment & Testing

## License

MIT
