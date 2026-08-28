-- =============================================
-- 002: Message threads for verified matches
-- =============================================

-- =============================================
-- MESSAGES
-- =============================================
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_messages_match    ON messages(match_id, created_at);
CREATE INDEX idx_messages_sender   ON messages(sender_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Only the two parties of an approved match can read messages
CREATE POLICY "Match participants can read messages"
  ON messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN lost_items  l ON l.id = m.lost_item_id
      JOIN found_items f ON f.id = m.found_item_id
      WHERE m.id = messages.match_id
        AND m.status = 'approved'
        AND (l.user_id = auth.uid() OR f.user_id = auth.uid())
    )
  );

-- Only the two parties of an approved match can send messages
CREATE POLICY "Match participants can send messages"
  ON messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN lost_items  l ON l.id = m.lost_item_id
      JOIN found_items f ON f.id = m.found_item_id
      WHERE m.id = match_id
        AND m.status = 'approved'
        AND (l.user_id = auth.uid() OR f.user_id = auth.uid())
    )
  );
