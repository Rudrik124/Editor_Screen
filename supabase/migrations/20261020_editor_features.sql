-- Migration: 20261020_editor_features.sql

-- 1. Structured timeline tracks
CREATE TABLE IF NOT EXISTS public.timeline_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Track',
  type TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  muted BOOLEAN DEFAULT FALSE,
  hidden BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Structured clips
CREATE TABLE IF NOT EXISTS public.timeline_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.timeline_tracks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL DEFAULT 'VIDEO',
  start_time NUMERIC NOT NULL DEFAULT 0,
  end_time NUMERIC NOT NULL,
  duration NUMERIC GENERATED ALWAYS AS (end_time - start_time) STORED,
  trim_start NUMERIC DEFAULT 0,
  trim_end NUMERIC DEFAULT 0,
  volume NUMERIC DEFAULT 1.0,
  playback_speed NUMERIC DEFAULT 1.0,
  opacity NUMERIC DEFAULT 1.0,
  rotation NUMERIC DEFAULT 0.0,
  scale NUMERIC DEFAULT 1.0,
  position_x NUMERIC DEFAULT 0,
  position_y NUMERIC DEFAULT 0,
  layer_index INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  locked BOOLEAN DEFAULT FALSE,
  muted BOOLEAN DEFAULT FALSE,
  hidden BOOLEAN DEFAULT FALSE,
  name TEXT,
  transition JSONB,
  filters JSONB DEFAULT '[]'::jsonb,
  effects JSONB DEFAULT '[]'::jsonb,
  text_data JSONB,
  keyframes JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Keyframe store
CREATE TABLE IF NOT EXISTS public.clip_keyframes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES public.timeline_clips(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  time_offset NUMERIC NOT NULL,
  property TEXT NOT NULL,
  value JSONB NOT NULL,
  interpolation TEXT DEFAULT 'linear',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI command audit log
CREATE TABLE IF NOT EXISTS public.ai_command_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  parsed_commands JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.timeline_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_keyframes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_command_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users own their tracks' AND tablename = 'timeline_tracks') THEN
    CREATE POLICY "Users own their tracks" ON public.timeline_tracks FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users own their clips' AND tablename = 'timeline_clips') THEN
    CREATE POLICY "Users own their clips" ON public.timeline_clips FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users own their keyframes' AND tablename = 'clip_keyframes') THEN
    CREATE POLICY "Users own their keyframes" ON public.clip_keyframes FOR ALL USING (
      project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users own their AI logs' AND tablename = 'ai_command_log') THEN
    CREATE POLICY "Users own their AI logs" ON public.ai_command_log FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tracks_project ON public.timeline_tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_track ON public.timeline_clips(track_id);
CREATE INDEX IF NOT EXISTS idx_clips_project ON public.timeline_clips(project_id);
CREATE INDEX IF NOT EXISTS idx_keyframes_clip ON public.clip_keyframes(clip_id);
CREATE INDEX IF NOT EXISTS idx_keyframes_time ON public.clip_keyframes(clip_id, time_offset);
