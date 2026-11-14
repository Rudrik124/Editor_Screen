-- Migration: 20261113_ai_credit_system.sql
-- Credit and billing ledger schema for Veytrix AI Assistant

-- 1. Subscription Tiers Configuration
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_credit_allowance INTEGER NOT NULL DEFAULT 20,
  signup_bonus_credits INTEGER NOT NULL DEFAULT 50,
  max_parallel_requests INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.subscription_tiers (id, name, monthly_credit_allowance, signup_bonus_credits, max_parallel_requests)
VALUES 
  ('free', 'Free Tier', 20, 50, 1),
  ('pro', 'Pro Tier', 1000, 0, 3)
ON CONFLICT (id) DO NOTHING;

-- 2. User Credit Balance
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL REFERENCES public.subscription_tiers(id) DEFAULT 'free',
  balance INTEGER NOT NULL DEFAULT 50 CHECK (balance >= 0),
  last_monthly_refill TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Immutable Credit Transaction Ledger
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  reference_id UUID,
  balance_after INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_time ON public.credit_ledger(user_id, created_at DESC);

-- 4. Atomic Stored Procedure: Deduct Credit
CREATE OR REPLACE FUNCTION public.deduct_ai_credit(
  p_user_id UUID,
  p_amount INTEGER DEFAULT 1,
  p_action TEXT DEFAULT 'ai_prompt',
  p_ref_id UUID DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, new_balance INTEGER, error_message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT balance INTO v_current_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'USER_CREDIT_RECORD_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_balance, 'INSUFFICIENT_CREDITS'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.user_credits
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_ledger (user_id, amount, action_type, reference_id, balance_after)
  VALUES (p_user_id, -p_amount, p_action, p_ref_id, v_new_balance);

  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- 5. Stored Procedure: Refund Credit
CREATE OR REPLACE FUNCTION public.refund_ai_credit(
  p_user_id UUID,
  p_amount INTEGER DEFAULT 1,
  p_reason TEXT DEFAULT 'execution_failure',
  p_ref_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE public.user_credits
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.credit_ledger (user_id, amount, action_type, reference_id, balance_after)
  VALUES (p_user_id, p_amount, 'refund', p_ref_id, v_new_balance);

  RETURN v_new_balance;
END;
$$;
