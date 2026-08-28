-- =============================================
-- 003: Admin fraud-flagging for matches
-- =============================================

-- Add fraud_flag and flag_reason to matches
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS fraud_flag   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason  TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at   TIMESTAMPTZ;

-- Index for fast retrieval of flagged matches
CREATE INDEX idx_matches_fraud_flag ON matches(fraud_flag) WHERE fraud_flag = true;
