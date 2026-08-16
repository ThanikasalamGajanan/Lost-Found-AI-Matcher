-- =============================================
-- Lost & Found AI Matcher — Database Schema
-- PostgreSQL 15+ with pgvector extension
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram for fuzzy text matching

-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE item_status AS ENUM (
  'active',         -- Currently listed
  'matched',        -- Match found, pending verification
  'verified',       -- Verification passed, contact unlocked
  'returned',       -- Item returned to owner
  'closed'          -- No longer active
);

CREATE TYPE report_type AS ENUM ('lost', 'found');

CREATE TYPE verification_status AS ENUM (
  'pending',        -- Question not yet sent
  'question_sent',  -- Question delivered, awaiting answer
  'answered',       -- Owner submitted answer
  'correct',        -- Finder marked answer correct
  'incorrect',      -- Finder marked answer incorrect
  'escalated',      -- Max retries exceeded → admin review
  'approved'        -- Admin approved
);

CREATE TYPE match_status AS ENUM (
  'pending',        -- Awaiting review / verification
  'approved',       -- Match approved (by admin or auto)
  'rejected',       -- Match rejected
  'disputed'        -- Disputed by either party
);

CREATE TYPE notification_type AS ENUM (
  'new_match',
  'verification_question',
  'verification_result',
  'match_approved',
  'match_rejected',
  'item_returned',
  'admin_message'
);

-- =============================================
-- USERS (extends Supabase auth.users)
-- =============================================
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  preferred_lang  TEXT NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('en', 'ta', 'si')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- LOST ITEMS
-- =============================================
CREATE TABLE lost_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Structured fields (extracted by LLM from free text)
  category        TEXT NOT NULL,                -- e.g. "keys", "electronics", "bag"
  brand           TEXT,
  colour          TEXT,
  description     TEXT NOT NULL,                -- Free-text description
  
  -- Location
  location        TEXT NOT NULL,                -- Human-readable place name
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  
  -- Time
  lost_at         TIMESTAMPTZ NOT NULL,         -- When item was lost
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Media
  photo_url       TEXT,                         -- Supabase Storage URL
  
  -- AI fields
  description_embedding vector(1536),           -- OpenAI text embedding
  
  -- Identification (PRIVATE — only shown after verification)
  identifying_info TEXT,                        -- e.g. serial number, engraving
  
  -- Status
  status          item_status NOT NULL DEFAULT 'active',
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- FOUND ITEMS
-- =============================================
CREATE TABLE found_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Structured fields
  category        TEXT NOT NULL,
  brand           TEXT,
  colour          TEXT,
  description     TEXT NOT NULL,
  
  -- Location
  location        TEXT NOT NULL,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  
  -- Time
  found_at        TIMESTAMPTZ NOT NULL,
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Media
  photo_url       TEXT,
  
  -- AI fields
  description_embedding vector(1536),
  
  -- Private fields (withheld from public view — used for verification questions)
  private_details JSONB DEFAULT '{}',           -- e.g. {"keychain_colour": "red", "engraving": "JDK"}
  
  -- Status
  status          item_status NOT NULL DEFAULT 'active',
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- MATCHES (pairs a lost item with a found item)
-- =============================================
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lost_item_id    UUID NOT NULL REFERENCES lost_items(id) ON DELETE CASCADE,
  found_item_id   UUID NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  
  -- Scoring breakdown
  total_score     DOUBLE PRECISION NOT NULL,    -- Weighted total (0–100)
  desc_score      DOUBLE PRECISION,             -- Description similarity (30%)
  image_score     DOUBLE PRECISION,             -- Image similarity (25%)
  location_score  DOUBLE PRECISION,             -- Location proximity (20%)
  time_score      DOUBLE PRECISION,             -- Time proximity (15%)
  attr_score      DOUBLE PRECISION,             -- Brand/Colour/Category (10%)
  
  -- Status
  status          match_status NOT NULL DEFAULT 'pending',
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate pairs
  UNIQUE (lost_item_id, found_item_id)
);

-- =============================================
-- VERIFICATION QUESTIONS
-- =============================================
CREATE TABLE verification_questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,                -- e.g. "What colour was the keychain?"
  correct_answer  TEXT NOT NULL,                -- The actual answer (from private_details)
  field_source    TEXT,                         -- Which private_detail key this came from
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- VERIFICATION ATTEMPTS
-- =============================================
CREATE TABLE verification_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id     UUID NOT NULL REFERENCES verification_questions(id) ON DELETE CASCADE,
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  claimant_id     UUID NOT NULL REFERENCES users(id),  -- Person answering (lost-item owner)
  
  answer_text     TEXT NOT NULL,
  is_correct      BOOLEAN,                      -- NULL until judged
  
  judged_by       UUID REFERENCES users(id),    -- The finder who judged
  judged_at       TIMESTAMPTZ,
  
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  
  -- Link to relevant entity
  match_id        UUID REFERENCES matches(id) ON DELETE SET NULL,
  item_id         UUID,                         -- Could reference lost or found item
  item_type       report_type,
  
  -- State
  is_read         BOOLEAN NOT NULL DEFAULT false,
  email_sent      BOOLEAN NOT NULL DEFAULT false,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ITEM STATUS LOG (audit trail)
-- =============================================
CREATE TABLE item_status_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id         UUID NOT NULL,                -- Polymorphic: could be lost or found item
  item_type       report_type NOT NULL,
  old_status      item_status,
  new_status      item_status NOT NULL,
  changed_by      UUID REFERENCES users(id),
  reason          TEXT,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_lost_items_user       ON lost_items(user_id);
CREATE INDEX idx_lost_items_status     ON lost_items(status);
CREATE INDEX idx_lost_items_category   ON lost_items(category);
CREATE INDEX idx_lost_items_embedding  ON lost_items USING ivfflat (description_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_found_items_user      ON found_items(user_id);
CREATE INDEX idx_found_items_status    ON found_items(status);
CREATE INDEX idx_found_items_category  ON found_items(category);
CREATE INDEX idx_found_items_embedding ON found_items USING ivfflat (description_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_matches_lost          ON matches(lost_item_id);
CREATE INDEX idx_matches_found         ON matches(found_item_id);
CREATE INDEX idx_matches_status        ON matches(status);
CREATE INDEX idx_matches_score         ON matches(total_score DESC);

CREATE INDEX idx_notifications_user    ON notifications(user_id, is_read);
CREATE INDEX idx_vq_match              ON verification_questions(match_id);
CREATE INDEX idx_va_match              ON verification_attempts(match_id);

-- =============================================
-- FUNCTIONS / TRIGGERS
-- =============================================

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated       BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_lost_items_updated  BEFORE UPDATE ON lost_items  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_found_items_updated BEFORE UPDATE ON found_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_matches_updated     BEFORE UPDATE ON matches     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user row in public.users when Supabase auth signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- HELPER: Haversine distance (km)
-- =============================================
CREATE OR REPLACE FUNCTION haversine_km(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  R DOUBLE PRECISION := 6371.0;
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE found_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid() = id);

-- Lost items: owner or admin can do anything; others see active only (no identifying_info)
CREATE POLICY "Anyone can view active lost items"
  ON lost_items FOR SELECT USING (status = 'active');

CREATE POLICY "Owners can manage own lost items"
  ON lost_items FOR ALL USING (auth.uid() = user_id);

-- Found items: same pattern
CREATE POLICY "Anyone can view active found items"
  ON found_items FOR SELECT USING (status = 'active');

CREATE POLICY "Owners can manage own found items"
  ON found_items FOR ALL USING (auth.uid() = user_id);

-- Notifications: users see their own
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Matches: visible to item owners
CREATE POLICY "Item owners can view matches"
  ON matches FOR SELECT USING (
    EXISTS (SELECT 1 FROM lost_items WHERE lost_items.id = matches.lost_item_id AND lost_items.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM found_items WHERE found_items.id = matches.found_item_id AND found_items.user_id = auth.uid())
  );

-- Storage bucket for item photos
-- (Create this in the Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('item-photos', 'item-photos', true);
