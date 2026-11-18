-- Migration: 20261118_ai_command_log_feedback_rlhf.sql
-- Upgrades ai_command_log to capture RLHF preference signals and user feedback loops

ALTER TABLE public.ai_command_log 
  ADD COLUMN IF NOT EXISTS user_feedback TEXT CHECK (user_feedback IN ('accepted', 'rejected', 'modified', 'undone')),
  ADD COLUMN IF NOT EXISTS modified_commands JSONB,
  ADD COLUMN IF NOT EXISTS undo_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_tier TEXT DEFAULT 'beginner' CHECK (user_tier IN ('beginner', 'intermediate', 'professional')),
  ADD COLUMN IF NOT EXISTS response_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Index for analytics and DPO dataset export
CREATE INDEX IF NOT EXISTS idx_ai_command_log_feedback ON public.ai_command_log(user_feedback, user_tier);
CREATE INDEX IF NOT EXISTS idx_ai_command_log_created_at ON public.ai_command_log(created_at DESC);
