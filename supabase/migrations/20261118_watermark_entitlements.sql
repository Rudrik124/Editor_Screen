CREATE TABLE IF NOT EXISTS public.watermark_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  premium_until TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.watermark_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.watermark_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.watermark_entitlements TO service_role;
