-- 001_create_tables.sql
-- Creates the three core neez tables per the PRD schema (Section 7).
-- Run this in the Supabase Dashboard SQL Editor.

-- =============================================================================
-- 1. neez_users — user profile and lifecycle data (one row per user)
-- =============================================================================
CREATE TABLE IF NOT EXISTS neez_users (
  user_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  full_name      text NOT NULL,
  gender         text,
  birth_date     date,
  device_type    text,
  sign_up_date   timestamptz,
  activation_date timestamptz,
  first_chat_date timestamptz,
  acquisition_source text,
  metadata       jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz
);

CREATE INDEX idx_neez_users_email   ON neez_users (email);
CREATE INDEX idx_neez_users_user_id ON neez_users (user_id);

-- =============================================================================
-- 2. neez_chat_sessions — one row per conversation session
-- =============================================================================
CREATE TABLE IF NOT EXISTS neez_chat_sessions (
  session_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES neez_users (user_id) ON DELETE CASCADE,
  session_created_at timestamptz NOT NULL DEFAULT now(),
  latitude           double precision,
  longitude          double precision,
  feedback_score     int CHECK (feedback_score BETWEEN 1 AND 5),
  closed_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neez_chat_sessions_user_id ON neez_chat_sessions (user_id);

-- =============================================================================
-- 3. neez_chat_messages — conversation content per session (JSONB)
-- =============================================================================
CREATE TABLE IF NOT EXISTS neez_chat_messages (
  session_id          uuid PRIMARY KEY REFERENCES neez_chat_sessions (session_id) ON DELETE CASCADE,
  conversation_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt_tokens       int NOT NULL DEFAULT 0,
  completion_tokens   int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neez_chat_messages_conversation_content
  ON neez_chat_messages USING GIN (conversation_content);
