-- 002_rls_policies.sql
-- Row Level Security: users can only read/write their own data.
-- Run this in the Supabase Dashboard SQL Editor AFTER 001_create_tables.sql.

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
ALTER TABLE neez_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE neez_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE neez_chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- neez_users policies
-- =============================================================================
CREATE POLICY "Users can read own profile"
  ON neez_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON neez_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON neez_users FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- neez_chat_sessions policies
-- =============================================================================
CREATE POLICY "Users can read own sessions"
  ON neez_chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON neez_chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON neez_chat_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- neez_chat_messages policies
-- Messages are linked to sessions, so access is gated through the session's user_id.
-- =============================================================================
CREATE POLICY "Users can read own messages"
  ON neez_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM neez_chat_sessions s
      WHERE s.session_id = neez_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own messages"
  ON neez_chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM neez_chat_sessions s
      WHERE s.session_id = neez_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages"
  ON neez_chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM neez_chat_sessions s
      WHERE s.session_id = neez_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM neez_chat_sessions s
      WHERE s.session_id = neez_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );
