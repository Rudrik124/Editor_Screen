# Veytrix Editor — 25-Feature Production Implementation Plan

## Goal

Build a production-ready, modular, 25-feature web video editor on top of the existing `D:\Editor_Screen` codebase. Every feature lives in its own `<300 LOC` plugin. The Command Pattern powers all timeline mutations for deterministic Undo/Redo. Zustand manages state. A hybrid rendering pipeline (DOM/CSS timeline + WebGL/Canvas preview) matches industry standard (CapCut/VN). An LLM Tool-Calling AI Assistant exposes all 25 features as natural-language commands.

---

## User Review Required

> [!IMPORTANT]
> **Architecture decisions locked in by the grill-me session:**
> - State: **Zustand** with slice-per-plugin pattern
> - Timeline UI: **DOM/CSS** (keep existing) 
> - Preview Renderer: **WebGL Canvas** (replace current `<video>` tag approach)
> - Backend: **Hybrid** — client-side WebCodecs preview + Python/FFmpeg cloud final export
> - AI Assistant: **LLM Tool Calling** (Gemini/OpenAI) for ALL 25 features, with fine-tuning planned for Phase 5
> - Merge strategy: `Editor_Screen` built as standalone, merged into `Roxy_new` after completion

> [!WARNING]
> **Schema migration required.** The existing `public.projects.timeline_json` column (JSONB, exists) needs 4 new tables: `timeline_tracks`, `timeline_clips`, `clip_keyframes`, `ai_command_log`. Migration is non-destructive — `timeline_json` continues to serve as the autosave envelope.

> [!CAUTION]
> **No file may exceed 300 lines.** Existing files that already approach this limit must be split during Phase 0 refactor (e.g., `VeytrixEditor.tsx` at 84 LOC is fine; `editor.css` at 347 LOC must be split).

---

## Open Questions

> [!IMPORTANT]
> 1. **LLM Provider:** Which API key is available — OpenAI, Gemini, or both? This affects `ai-assistant.processor.ts` in Phase 4.
> 2. **Supabase Storage buckets:** Does `Roxy_new` already have `videos`, `images`, `audio` buckets configured? The asset upload pipeline in Phase 2 depends on this.
> 3. **WebGL shader complexity:** Should LUT-based color grading (Feature #19 Filters) use pre-baked GLSL shaders or a runtime `ffmpeg.wasm` fallback for preview? This affects Phase 3 scope.

---

## Supabase Schema Diff

### Existing Tables (from MCP inspection)

| Table | Status | Notes |
|---|---|---|
| `public.profiles` | ✅ Keep | RLS enabled |
| `public.projects` | ✅ Keep + Extend | Has `timeline_json JSONB` — good as autosave envelope |
| `public.assets` | ✅ Keep | Stores effects/filters catalog (type, engine_key, category) |
| `public.exports` | ✅ Keep | Export job tracking |
| `public.credits` | ✅ Keep | |
| `public.workspaces` | ✅ Keep | |

### Missing Tables — New Migration Required

```sql
-- Migration: 20261020_editor_features.sql

-- 1. Structured timeline tracks (replaces flat timeline_json tracks array)
CREATE TABLE public.timeline_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Track',
  type TEXT NOT NULL,              -- 'VIDEO' | 'AUDIO' | 'TEXT' | 'OVERLAY' | 'MUSIC'
  order_index INTEGER NOT NULL DEFAULT 0,
  muted BOOLEAN DEFAULT FALSE,
  hidden BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Structured clips (replaces flat timeline_json clips array)
CREATE TABLE public.timeline_clips (
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
  name TEXT,                        -- Rename feature
  -- JSONB blobs for complex nested data
  transition JSONB,                 -- TransitionData
  filters JSONB DEFAULT '[]'::jsonb,
  effects JSONB DEFAULT '[]'::jsonb,
  text_data JSONB,                  -- TextData for text clips
  keyframes JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb, -- flip_h, flip_v, reverse, freeze_duration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Keyframe store (normalized for efficient range queries)
CREATE TABLE public.clip_keyframes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES public.timeline_clips(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  time_offset NUMERIC NOT NULL,    -- seconds from clip start
  property TEXT NOT NULL,          -- 'opacity' | 'scale' | 'position_x' | 'position_y' | 'rotation' | 'volume'
  value JSONB NOT NULL,            -- numeric or {x, y} object
  interpolation TEXT DEFAULT 'linear', -- 'linear' | 'bezier' | 'hold'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI command audit log
CREATE TABLE public.ai_command_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  parsed_commands JSONB NOT NULL,   -- Array of EditorCommand objects
  status TEXT DEFAULT 'pending',    -- 'pending' | 'applied' | 'rejected' | 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.timeline_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_keyframes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_command_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their tracks" ON public.timeline_tracks
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their clips" ON public.timeline_clips
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their keyframes" ON public.clip_keyframes
  FOR ALL USING (auth.uid() = project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  ));
CREATE POLICY "Users own their AI logs" ON public.ai_command_log
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_tracks_project ON public.timeline_tracks(project_id);
CREATE INDEX idx_clips_track ON public.timeline_clips(track_id);
CREATE INDEX idx_clips_project ON public.timeline_clips(project_id);
CREATE INDEX idx_keyframes_clip ON public.clip_keyframes(clip_id);
CREATE INDEX idx_keyframes_time ON public.clip_keyframes(clip_id, time_offset);
```

---

## Directory & Module Blueprint

```
d:\Editor_Screen\
├── src/
│   └── main.tsx
├── editor screen/                          ← EXISTING (keep, extend)
│   ├── VeytrixEditor.tsx                   ← REFACTOR: remove useState, connect Zustand
│   ├── index.ts
│   ├── types/
│   │   ├── editor.types.ts                 ← EXTEND: add ClipModel, TrackModel, EditorCommand
│   │   └── ai.types.ts                     [NEW]
│   ├── store/                              [NEW DIRECTORY]
│   │   ├── editor.store.ts                 ← Zustand root store (<250 LOC)
│   │   ├── command.bus.ts                  ← Command dispatcher + undo/redo history
│   │   └── store.selectors.ts              ← Memoized selectors
│   ├── renderer/                           [NEW DIRECTORY]
│   │   ├── webgl.renderer.ts               ← WebGL canvas compositor
│   │   ├── webgl.shaders.ts                ← GLSL shader strings
│   │   └── frame.scheduler.ts              ← requestAnimationFrame loop
│   ├── hooks/
│   │   ├── useEditorStore.ts               [NEW]
│   │   └── useCommand.ts                   [NEW]
│   ├── components/
│   │   ├── EditorHeader.tsx                ← Keep
│   │   ├── MediaLibrary.tsx                ← Keep
│   │   ├── PlaybackBar.tsx                 ← EXTEND: connect to store
│   │   ├── PreviewWorkspace.tsx            ← REFACTOR: switch to WebGL canvas
│   │   ├── RightInspector.tsx              ← EXTEND: per-feature panels
│   │   ├── TimelineToolbar.tsx             ← EXTEND: undo/redo buttons
│   │   ├── TimelineWorkspace.tsx           ← REFACTOR: read from store
│   │   ├── TimelineTrack.tsx               ← Keep
│   │   ├── TimelineClip.tsx                ← EXTEND: context menu
│   │   └── utils/
│   │       └── formatVideoTime.ts
│   ├── plugins/                            [NEW DIRECTORY — all 25 features]
│   │   │
│   │   ├── duplicate/
│   │   │   ├── index.ts
│   │   │   ├── duplicate.command.ts
│   │   │   ├── duplicate.state.ts
│   │   │   ├── duplicate.processor.ts
│   │   │   └── duplicate.ui.tsx
│   │   │
│   │   ├── split/
│   │   │   ├── index.ts
│   │   │   ├── split.command.ts
│   │   │   ├── split.state.ts
│   │   │   ├── split.processor.ts
│   │   │   └── split.ui.tsx
│   │   │
│   │   ├── trim/
│   │   │   ├── index.ts
│   │   │   ├── trim.command.ts
│   │   │   ├── trim.state.ts
│   │   │   ├── trim.processor.ts
│   │   │   └── trim.ui.tsx
│   │   │
│   │   ├── transition/
│   │   │   ├── index.ts
│   │   │   ├── transition.command.ts
│   │   │   ├── transition.state.ts
│   │   │   ├── transition.processor.ts
│   │   │   └── transition.ui.tsx
│   │   │
│   │   ├── overlap/
│   │   │   ├── index.ts
│   │   │   ├── overlap.command.ts
│   │   │   ├── overlap.state.ts
│   │   │   ├── overlap.processor.ts
│   │   │   └── overlap.ui.tsx
│   │   │
│   │   ├── reverse/
│   │   │   ├── index.ts
│   │   │   ├── reverse.command.ts
│   │   │   ├── reverse.state.ts
│   │   │   ├── reverse.processor.ts
│   │   │   └── reverse.ui.tsx
│   │   │
│   │   ├── extract-audio/
│   │   │   ├── index.ts
│   │   │   ├── extract-audio.command.ts
│   │   │   ├── extract-audio.state.ts
│   │   │   ├── extract-audio.processor.ts
│   │   │   └── extract-audio.ui.tsx
│   │   │
│   │   ├── keyframe/
│   │   │   ├── index.ts
│   │   │   ├── keyframe.command.ts
│   │   │   ├── keyframe.state.ts
│   │   │   ├── keyframe.processor.ts
│   │   │   └── keyframe.ui.tsx
│   │   │
│   │   ├── speed/
│   │   │   ├── index.ts
│   │   │   ├── speed.command.ts
│   │   │   ├── speed.state.ts
│   │   │   ├── speed.processor.ts
│   │   │   └── speed.ui.tsx
│   │   │
│   │   ├── audio/
│   │   │   ├── index.ts
│   │   │   ├── audio.command.ts
│   │   │   ├── audio.state.ts
│   │   │   ├── audio.processor.ts
│   │   │   └── audio.ui.tsx
│   │   │
│   │   ├── mute/
│   │   │   ├── index.ts
│   │   │   ├── mute.command.ts
│   │   │   ├── mute.state.ts
│   │   │   ├── mute.processor.ts
│   │   │   └── mute.ui.tsx
│   │   │
│   │   ├── freeze/
│   │   │   ├── index.ts
│   │   │   ├── freeze.command.ts
│   │   │   ├── freeze.state.ts
│   │   │   ├── freeze.processor.ts
│   │   │   └── freeze.ui.tsx
│   │   │
│   │   ├── cover/
│   │   │   ├── index.ts
│   │   │   ├── cover.command.ts
│   │   │   ├── cover.state.ts
│   │   │   ├── cover.processor.ts
│   │   │   └── cover.ui.tsx
│   │   │
│   │   ├── replace/
│   │   │   ├── index.ts
│   │   │   ├── replace.command.ts
│   │   │   ├── replace.state.ts
│   │   │   ├── replace.processor.ts
│   │   │   └── replace.ui.tsx
│   │   │
│   │   ├── rename/
│   │   │   ├── index.ts
│   │   │   ├── rename.command.ts
│   │   │   ├── rename.state.ts
│   │   │   ├── rename.processor.ts
│   │   │   └── rename.ui.tsx
│   │   │
│   │   ├── lock/
│   │   │   ├── index.ts
│   │   │   ├── lock.command.ts
│   │   │   ├── lock.state.ts
│   │   │   ├── lock.processor.ts
│   │   │   └── lock.ui.tsx
│   │   │
│   │   ├── delete/
│   │   │   ├── index.ts
│   │   │   ├── delete.command.ts
│   │   │   ├── delete.state.ts
│   │   │   ├── delete.processor.ts
│   │   │   └── delete.ui.tsx
│   │   │
│   │   ├── effects/
│   │   │   ├── index.ts
│   │   │   ├── effects.command.ts
│   │   │   ├── effects.state.ts
│   │   │   ├── effects.processor.ts
│   │   │   └── effects.ui.tsx
│   │   │
│   │   ├── filters/
│   │   │   ├── index.ts
│   │   │   ├── filters.command.ts
│   │   │   ├── filters.state.ts
│   │   │   ├── filters.processor.ts  ← GLSL LUT shader compilation
│   │   │   └── filters.ui.tsx
│   │   │
│   │   ├── caption/
│   │   │   ├── index.ts
│   │   │   ├── caption.command.ts
│   │   │   ├── caption.state.ts
│   │   │   ├── caption.processor.ts  ← Whisper API call
│   │   │   └── caption.ui.tsx
│   │   │
│   │   ├── ratio/
│   │   │   ├── index.ts
│   │   │   ├── ratio.command.ts
│   │   │   ├── ratio.state.ts
│   │   │   ├── ratio.processor.ts
│   │   │   └── ratio.ui.tsx
│   │   │
│   │   ├── text/
│   │   │   ├── index.ts
│   │   │   ├── text.command.ts
│   │   │   ├── text.state.ts
│   │   │   ├── text.processor.ts
│   │   │   └── text.ui.tsx
│   │   │
│   │   ├── media/
│   │   │   ├── index.ts
│   │   │   ├── media.command.ts
│   │   │   ├── media.state.ts
│   │   │   ├── media.processor.ts
│   │   │   └── media.ui.tsx
│   │   │
│   │   ├── undo-redo/
│   │   │   ├── index.ts
│   │   │   ├── undo-redo.command.ts
│   │   │   ├── undo-redo.state.ts
│   │   │   ├── undo-redo.processor.ts
│   │   │   └── undo-redo.ui.tsx
│   │   │
│   │   └── ai-assistant/
│   │       ├── index.ts
│   │       ├── ai-assistant.command.ts   ← Tool-calling dispatcher
│   │       ├── ai-assistant.state.ts
│   │       ├── ai-assistant.processor.ts ← LLM API call + schema validation
│   │       ├── ai-assistant.tools.ts     ← 25 tool definitions (JSON Schema)
│   │       └── ai-assistant.ui.tsx       ← Chat panel
│   │
│   ├── data/
│   │   └── editorMockData.ts             ← Keep during transition
│   ├── left-side toolbar/                ← KEEP existing structure
│   └── styles/
│       ├── editor.css                    ← SPLIT into tokens.css + layout.css + components.css
│       └── editor-layout-fixes.css       ← Keep
│
├── package.json                          ← ADD: zustand, @supabase/supabase-js
├── vite.config.ts
└── tsconfig.app.json
```

---

## Core Architecture Contracts

### Command Pattern

Every state mutation is a serializable `EditorCommand` object:

```typescript
// editor screen/types/editor.types.ts (EXTEND)

export type CommandType =
  | 'DUPLICATE_CLIP' | 'SPLIT_CLIP' | 'TRIM_CLIP' | 'REVERSE_CLIP'
  | 'FREEZE_CLIP' | 'REPLACE_CLIP' | 'RENAME_CLIP' | 'LOCK_CLIP'
  | 'DELETE_CLIP' | 'ADD_TRANSITION' | 'REMOVE_TRANSITION'
  | 'SET_OVERLAP' | 'SET_COVER' | 'SET_RATIO' | 'MOVE_CLIP'
  | 'ADD_KEYFRAME' | 'REMOVE_KEYFRAME' | 'SET_SPEED'
  | 'EXTRACT_AUDIO' | 'SET_AUDIO_VOLUME' | 'MUTE_CLIP'
  | 'ADD_EFFECT' | 'REMOVE_EFFECT' | 'SET_FILTER' | 'REMOVE_FILTER'
  | 'ADD_CAPTION' | 'UPDATE_CAPTION' | 'DELETE_CAPTION'
  | 'ADD_TEXT' | 'UPDATE_TEXT' | 'DELETE_TEXT'
  | 'IMPORT_ASSET' | 'REMOVE_ASSET'
  | 'UNDO' | 'REDO';

export interface EditorCommand {
  type: CommandType;
  payload: Record<string, unknown>;
  inverse?: EditorCommand;          // Auto-generated for undo
  timestamp: number;
  id: string;                       // UUID for deduplication
}
```

### Zustand Store Shape

```typescript
// editor screen/store/editor.store.ts

interface EditorState {
  // Timeline
  tracks: TrackModel[];
  clips: Record<string, ClipModel>;   // clipId → ClipModel (normalized)
  selectedClipId: string | null;
  selectedTrackId: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;

  // Project
  projectId: string | null;
  aspectRatio: AspectRatio;
  fps: number;
  resolution: Resolution;

  // Command History (Undo/Redo)
  history: EditorCommand[];           // Applied commands
  future: EditorCommand[];            // Undone commands
  historyLimit: number;               // Default 50

  // Rendering
  rendererReady: boolean;

  // AI
  aiPanelOpen: boolean;
  aiLoading: boolean;
  lastAiResponse: AiResponse | null;

  // Actions
  dispatch: (command: EditorCommand) => void;
  undo: () => void;
  redo: () => void;
}
```

### Plugin Index Contract

Each plugin exports this interface from its `index.ts`:

```typescript
// Template for every plugin/[feature]/index.ts

export interface EditorPlugin {
  name: string;
  commandTypes: CommandType[];
  execute: (command: EditorCommand, state: EditorState) => Partial<EditorState>;
  reverse: (command: EditorCommand, state: EditorState) => EditorCommand;
  aiToolDefinition: AIToolDefinition;   // JSON Schema for LLM tool calling
}
```

### AI Tool Definition Contract

```typescript
// editor screen/types/ai.types.ts

export interface AIToolDefinition {
  name: string;         // e.g., "trim_clip"
  description: string;  // Natural language description for the LLM
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required: string[];
  };
}

// Example: split plugin's tool definition
export const splitToolDefinition: AIToolDefinition = {
  name: 'split_clip',
  description: 'Split a video clip at a specific time position. Use this when the user says "split", "cut at", "divide at", or similar.',
  parameters: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'ID of the clip to split' },
      splitTime: { type: 'number', description: 'Timeline time in seconds where the split should occur' }
    },
    required: ['splitTime']
  }
};
```

---

## Phased Execution Roadmap

### Phase 0 — Foundation (Week 1–2)
**Dependencies:** None. Enables all other phases.

**Goal:** Replace React `useState` prop-drilling with Zustand + Command Bus. Set up WebGL canvas renderer. Run Supabase migration.

**Files to create:**
- `editor screen/store/editor.store.ts` — Zustand store
- `editor screen/store/command.bus.ts` — dispatch + history
- `editor screen/store/store.selectors.ts` — selectors
- `editor screen/renderer/webgl.renderer.ts` — WebGL canvas
- `editor screen/renderer/webgl.shaders.ts` — baseline passthrough shader
- `editor screen/renderer/frame.scheduler.ts` — rAF loop
- `editor screen/hooks/useEditorStore.ts`
- `editor screen/hooks/useCommand.ts`

**Files to refactor:**
- `VeytrixEditor.tsx` — replace all `useState` with Zustand reads; connect `dispatch`
- `TimelineWorkspace.tsx` — read tracks/clips from store instead of props
- `PreviewWorkspace.tsx` — replace `<video>` tag with WebGL canvas
- `editor.css` — split into `tokens.css` + `layout.css` + `timeline.css` (≤300 LOC each)
- `editor screen/types/editor.types.ts` — extend with `ClipModel`, `TrackModel`, `EditorCommand`

**New packages to install:**
```bash
npm install zustand @supabase/supabase-js
```

**Supabase migration:**
- Run `20261020_editor_features.sql` migration (4 new tables + RLS)

---

### Phase 1 — Undo/Redo + Core Clip Operations (Week 3–4)
**Dependencies:** Phase 0 complete.

**Features:** #25 Undo/Redo, #2 Split, #1 Duplicate, #17 Delete, #15 Rename, #16 Lock

**Goal:** Every mutation goes through the Command Bus with inversion. Users can hit Ctrl+Z and get back their exact prior state.

---

### Phase 2 — Trim, Speed, Reverse, Freeze (Week 5–6)
**Dependencies:** Phase 1 (Command Bus proven working).

**Features:** #3 Trim, #9 Speed, #6 Reverse, #12 Freeze

**Goal:** These four features involve altering `trim_start`, `trim_end`, `playback_speed`, and `metadata.freeze_duration` on `ClipModel`. The WebGL renderer must respect these during frame scheduling.

---

### Phase 3 — Layering, Transitions, Keyframes (Week 7–9)
**Dependencies:** Phase 2 (WebGL renderer confirmed stable).

**Features:** #4 Transition, #5 Overlap (PIP), #8 Keyframe, #13 Cover, #21 Ratio, #14 Replace

**Goal:** This is the most complex rendering phase. PIP/Overlay requires the compositor to stack WebGL textures by `layer_index`. Keyframes require the rAF loop to interpolate values per frame using the `clip_keyframes` table. Transitions need an `xfade`-equivalent GLSL shader.

---

### Phase 4 — Audio Pipeline (Week 10–11)
**Dependencies:** Phase 1 (Mute/Lock commands established).

**Features:** #7 Extract Audio, #10 Audio (BGM/SFX), #11 Mute

**Goal:** Audio uses the Web Audio API (`AudioContext`) synced to the WebGL renderer's frame timestamps. Each audio clip gets an `AudioBufferSourceNode` + `GainNode`.

---

### Phase 5 — Visuals, Text, Captions, Media Bin (Week 12–14)
**Dependencies:** Phase 3 (WebGL compositor ready for shader overlays).

**Features:** #18 Effects, #19 Filters, #20 Caption, #22 Text, #23 Media

**Goal:** Filters and Effects are GLSL fragment shader uniforms applied in the compositor pipeline. Captions call the Roxy Python backend `/api/v1/captions/transcribe` endpoint (Whisper). Text clips use the existing `TextElement` system, migrated to the Command Pattern.

---

### Phase 6 — AI Assistant (Week 15–16)
**Dependencies:** ALL prior phases (all 25 tool definitions registered).

**Features:** #24 AI Assistant

**Goal:** A floating chat panel sends user prompts to the LLM API with a system prompt containing the full project state manifest (tracks, clips, current time) + all 25 tool schemas. The LLM returns `tool_calls` which are validated against Pydantic schemas on the Python backend, then dispatched as `EditorCommand[]` to the Zustand store's Command Bus.

---

## Deep-Dive Feature Specifications

### Feature #25 — Undo & Redo

**State mutations:**
```typescript
// undo-redo/undo-redo.command.ts
dispatch({ type: 'UNDO' })
// command.bus.ts pops history stack, executes command.inverse
// pushes to future stack

dispatch({ type: 'REDO' })
// pops future stack, re-executes original command
// pushes back to history
```

**Keyboard binding:** `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`

**History limit:** 50 commands (configurable via store). Oldest commands purged when exceeded.

**Supabase sync:** After any dispatch, a debounced (2s) autosave posts the full `timeline_json` envelope to `POST /api/v1/projects/{id}/autosave`. Structured tables (`timeline_clips`, `timeline_tracks`) sync after every 10 commands or on page unload.

---

### Feature #1 — Duplicate Clip

**Command:**
```typescript
{ type: 'DUPLICATE_CLIP', payload: { clipId: 'clip-123' } }
```

**Processor logic (`duplicate.processor.ts`):**
- Deep-clone the clip object
- Generate new UUID for the duplicate
- Set `start_time = original.end_time` (appended after original on same track)
- If no space exists, place on a new overlay track

**Inverse:** `DELETE_CLIP` targeting the duplicated clip's new UUID

**UI:** Right-click context menu item "Duplicate" on `TimelineClip`. Also toolbar button.

**AI Tool:** `"duplicate the clip at 3 seconds"` → LLM resolves clip by time → `DUPLICATE_CLIP { clipId }`

---

### Feature #2 — Split Clip

**Command:**
```typescript
{ type: 'SPLIT_CLIP', payload: { clipId: 'clip-123', splitTime: 4.5 } }
```

**Processor logic (`split.processor.ts`):**
1. Find clip where `clip.start_time <= splitTime <= clip.end_time`
2. Create `clipA`: `{ ...clip, end_time: splitTime, trim_end: originalTrimStart + (splitTime - clip.start_time) }`
3. Create `clipB`: `{ ...clip, id: newUUID(), start_time: splitTime, trim_start: clipA.trim_end }`
4. Remove original clip, insert A and B

**Inverse:** Merge A and B back to original clip

**UI:** "Split" button in `TimelineToolbar.tsx` (acts on selected clip at playhead position). Keyboard: `S`

**AI Tool:** `"split at the playhead"` or `"cut the video at 4 seconds"`

---

### Feature #3 — Trim

**Command:**
```typescript
{ type: 'TRIM_CLIP', payload: { clipId, edge: 'left' | 'right', newTime: number } }
```

**Processor logic (`trim.processor.ts`):**
- `edge === 'left'`: update `clip.start_time` and `clip.trim_start`; enforce `min duration = 0.1s`
- `edge === 'right'`: update `clip.end_time` and `clip.trim_end`; enforce `min duration = 0.1s`
- Recalculate downstream clips to close gaps (or leave gaps — configurable)

**Existing code migration:** `TimelineClip.tsx` already has pointer-drag resize handles. Migrate to dispatch `TRIM_CLIP` via `useCommand` hook instead of calling `onResizeText` prop.

**AI Tool:** `"trim the video to start at 2 seconds"` or `"make the first clip 5 seconds long"`

---

### Feature #4 — Transition

**Command:**
```typescript
{
  type: 'ADD_TRANSITION',
  payload: {
    clipId: 'clip-123',          // clip BEFORE the cut
    transition: {
      transition_type: 'dissolve',
      duration: 1.0,
      easing: 'ease-in-out'
    }
  }
}
```

**Renderer interaction (`transition.processor.ts`):**
- During the overlap window `[clipA.end_time - duration, clipA.end_time]`, the WebGL compositor runs both clip textures simultaneously
- A transition GLSL shader blends from texture A to texture B using a `mix(colorA, colorB, progress)` formula
- `progress` = `(currentTime - transitionStart) / duration` clamped `[0, 1]`
- Applied easing function transforms `progress` before passing to shader

**Available transitions** (mapped to GLSL shaders):
- `dissolve` → `mix(a, b, p)`
- `fade` → fade to black then in
- `slideleft` → texture offset `vec2(-p, 0)`
- `slideright` → texture offset `vec2(p, 0)`
- `zoom` → scale A from 1→0, B from 2→1
- `glitch` → RGB channel split + pixel noise

**UI:** Clicking the gap/cut point between two clips in `TimelineWorkspace` opens transition picker panel.

**AI Tool:** `"add a dissolve transition between clip 1 and clip 2"`

---

### Feature #5 — Overlap (PIP/Overlay Tracks)

**Command:**
```typescript
{ type: 'SET_OVERLAP', payload: { clipId, trackId: 'overlay-track-1', position: { x: 20, y: 20 }, scale: 0.4 } }
```

**Processor logic:** Moves clip to a track with `type: 'OVERLAY'` and sets `position_x`, `position_y`, `scale`. The WebGL compositor layers OVERLAY tracks above VIDEO tracks using Z-index ordered rendering.

**UI:** Drag a clip from the video track upward to auto-create an overlay track with a PIP preview.

**AI Tool:** `"put clip 2 as a picture in picture in the top right"`

---

### Feature #6 — Reverse

**Command:**
```typescript
{ type: 'REVERSE_CLIP', payload: { clipId } }
```

**Processor logic (`reverse.processor.ts`):**
- Toggle `clip.metadata.reverse = !clip.metadata.reverse`
- In the WebGL frame scheduler: when `reverse === true`, request frame at `localTime = (clip.duration - currentLocalTime)`
- Backend FFmpeg: `reverse = true` → apply `reverse` + `areverse` filters during export

**Inverse:** Another `REVERSE_CLIP` command (toggle)

**AI Tool:** `"reverse clip 3"` or `"play the second clip backwards"`

---

### Feature #7 — Extract Audio

**Command:**
```typescript
{ type: 'EXTRACT_AUDIO', payload: { clipId } }
```

**Processor logic (`extract-audio.processor.ts`):**
1. Find clip on VIDEO track
2. Create new clip on the AUDIO track with same `start_time`, `duration`, `asset_id`, `muted = false`
3. Set original video clip `muted = true` (audio extracted to separate track)

**Inverse:** Delete audio clip + unmute video clip

**UI:** Right-click context menu → "Extract Audio"

**AI Tool:** `"extract the audio from clip 2"` or `"separate the audio track"`

---

### Feature #8 — Keyframe

**Command:**
```typescript
{
  type: 'ADD_KEYFRAME',
  payload: {
    clipId,
    timeOffset: 2.5,       // Seconds from clip start
    property: 'opacity',   // | 'scale' | 'position_x' | 'position_y' | 'rotation' | 'volume'
    value: 0.0,
    interpolation: 'linear'
  }
}
```

**Processor logic (`keyframe.processor.ts`):**
- Insert keyframe into `clip.keyframes[]` array, sorted by `timeOffset`
- During rAF loop: for each active clip, evaluate all properties at `currentLocalTime`
- Linear interpolation: `lerp(prevValue, nextValue, progress)`
- Bezier interpolation: De Casteljau with stored control points

**UI:** Keyframe diamond markers on the timeline clip. Inspector panel shows all keyframes for selected clip. Click "Add Keyframe" button while at desired playhead position.

**Supabase:** Keyframes synced to `clip_keyframes` table on autosave.

**AI Tool:** `"fade in the clip opacity from 0 to 1 over the first 2 seconds"`

---

### Feature #9 — Speed

**Command:**
```typescript
{ type: 'SET_SPEED', payload: { clipId, speed: 2.0 } }
```

**Processor logic (`speed.processor.ts`):**
- Set `clip.playback_speed = speed`
- Recalculate `clip.end_time = clip.start_time + (originalDuration / speed)`
- In WebGL frame scheduler: `localTime = currentGlobalOffset * speed`
- Speed curve/ramp: store as keyframes on a synthetic `speed` property

**Supported values:** 0.1x to 4.0x (enforced in processor)

**UI:** Speed slider in Right Inspector when clip selected. Curve ramp available via keyframe editor.

**AI Tool:** `"speed up clip 1 to 2x"` or `"slow down the third clip to half speed"`

---

### Feature #10 — Audio (BGM/SFX Tracks)

**Command:**
```typescript
{ type: 'SET_AUDIO_VOLUME', payload: { clipId, volume: 0.8 } }
```

**Audio engine (`audio.processor.ts`):**
- Each MUSIC/AUDIO clip gets an `AudioBufferSourceNode` in the `AudioContext`
- Volume controlled via `GainNode`: `gainNode.gain.value = clip.volume`
- Volume envelope: keyframes on `volume` property, applied to `gainNode.gain` using `setValueAtTime` + `linearRampToValueAtTime`
- BGM import: same `createVideoAsset` pipeline, but for audio files

**UI:** Volume slider per clip in Right Inspector. Waveform visualization on audio track clips (Canvas 2D inside clip element).

**AI Tool:** `"set the music volume to 50%"` or `"fade out the background music in the last 3 seconds"`

---

### Feature #11 — Mute

**Command:**
```typescript
{ type: 'MUTE_CLIP', payload: { clipId, muted: true } }
```

**Processor:** Toggle `clip.muted`. WebGL renderer skips audio playback for muted clips. Track-level mute sets `track.muted` and all clips in it.

**UI:** Speaker icon on each clip and track label. Click to toggle.

**AI Tool:** `"mute clip 2"` or `"unmute the background music"`

---

### Feature #12 — Freeze Frame

**Command:**
```typescript
{ type: 'FREEZE_CLIP', payload: { clipId, freezeAt: 3.0, freezeDuration: 2.0 } }
```

**Processor logic (`freeze.processor.ts`):**
1. Split clip at `freezeAt` → `clipA` and `clipB`
2. Insert a new clip between them with `metadata.freeze_frame = true` and `duration = freezeDuration`
3. The freeze clip references the same asset but its frame scheduler always returns `freezeAt` as the decode time

**UI:** Right-click → "Add Freeze Frame" → enter duration dialog.

**AI Tool:** `"freeze the video at 5 seconds for 3 seconds"`

---

### Feature #13 — Cover (Poster/Thumbnail Frame)

**Command:**
```typescript
{ type: 'SET_COVER', payload: { clipId, coverTime: 2.5 } }
```

**Processor:** Captures the frame at `coverTime` from the video asset using `captureFrame()` (existing utility). Sets `clip.metadata.cover_url` with the data URL. Updates project `thumbnail_url` in Supabase if this is the main video track.

**UI:** Right-click clip → "Set as Cover". Scrub a mini-preview to choose the frame.

**AI Tool:** `"use the frame at 3 seconds as the project thumbnail"`

---

### Feature #14 — Replace Clip

**Command:**
```typescript
{ type: 'REPLACE_CLIP', payload: { clipId, newAssetId: 'asset-456' } }
```

**Processor:** Keep `start_time`, `end_time`, `filters`, `effects`, `keyframes` from original clip. Replace `asset_id`, `media_url`, re-extract thumbnails for new asset. Clamp `trim_end` if new asset is shorter.

**UI:** Drag a new asset from Media Library onto an existing clip.

**AI Tool:** `"replace the first clip with the uploaded video"`

---

### Feature #15 — Rename Clip

**Command:**
```typescript
{ type: 'RENAME_CLIP', payload: { clipId, name: 'Intro Scene' } }
```

**UI:** Double-click clip label in timeline to edit inline.

**AI Tool:** `"rename clip 2 to 'Main Speech'"`

---

### Feature #16 — Lock Clip

**Command:**
```typescript
{ type: 'LOCK_CLIP', payload: { clipId, locked: true } }
```

**Processor:** Set `clip.locked = true`. Command Bus rejects any mutation command targeting a locked clip (returns early with a console warning). Lock icon overlay on clip in timeline.

**AI Tool:** `"lock clip 1 so it can't be moved"`

---

### Feature #17 — Delete Clip

**Command:**
```typescript
{ type: 'DELETE_CLIP', payload: { clipId } }
```

**Inverse:** `ADD_CLIP` with the full original clip snapshot.

**UI:** `Delete` key when clip selected. Right-click → "Delete". Also toolbar button.

**AI Tool:** `"delete clip 3"` or `"remove the last clip"`

---

### Feature #18 — Effects

**Command:**
```typescript
{
  type: 'ADD_EFFECT',
  payload: {
    clipId,
    effect: { effect_id: 'vhs-retro', intensity: 0.8, parameters: {} }
  }
}
```

**WebGL integration (`effects.processor.ts`):**
- Each effect has a corresponding GLSL fragment shader in `webgl.shaders.ts`
- Applied as a post-processing pass after the base clip texture is rendered
- Multiple effects stacked: render to framebuffer, chain shader passes

**Available effects (Phase 5 scope):**
- VHS Retro (scanlines + color bleed)
- Glitch Core (RGB split + horizontal tear)
- Film Grain (noise texture overlay)
- Vignette (radial dark edge)
- Chromatic Aberration

**Catalog source:** `GET /api/v1/assets/effects` from Roxy backend

**AI Tool:** `"add a glitch effect to clip 1"` or `"apply VHS effect at 50% intensity"`

---

### Feature #19 — Filters (LUTs)

**Command:**
```typescript
{
  type: 'SET_FILTER',
  payload: {
    clipId,
    filter: { filter_id: 'teal_orange', intensity: 0.7 }
  }
}
```

**WebGL integration (`filters.processor.ts`):**
- LUT filters are implemented as 3D textures (or 2D strip textures for simpler LUTs) uploaded to WebGL
- The fragment shader samples the LUT: `texture3D(lutTexture, originalColor.rgb)`
- `intensity` linearly mixes between original and graded color: `mix(original, graded, intensity)`
- LUT cube files (`.cube`) fetched from CDN/Supabase storage, parsed to Float32Array for WebGL upload

**Available presets:** Hollywood Gold, Teal & Orange, Vintage Cinema, Monochrome, Cold Cinema (matching Roxy FFmpeg mappings)

**AI Tool:** `"apply a teal and orange filter to the first clip"` or `"add a vintage film look"`

---

### Feature #20 — Caption (Auto-Transcribe)

**Command:**
```typescript
{
  type: 'ADD_CAPTION',
  payload: {
    clipId,
    captions: [{ id, text, startTime, endTime }]
  }
}
```

**Processor flow (`caption.processor.ts`):**
1. POST video asset URL to `POST /api/v1/captions/transcribe` (Roxy backend, Whisper)
2. Receive word-level timestamps
3. Auto-create TEXT track clips from transcript
4. Each caption word group → one `ClipModel` with `text_data` and timed `start_time`/`end_time`
5. Captions rendered by WebGL compositor as text overlays using Canvas 2D text-to-texture

**UI:** "Auto Caption" button in Left Sidebar. Caption editor panel in Right Inspector to edit/retime individual captions. SRT export button.

**AI Tool:** `"generate captions for the video"` or `"add subtitles in English"`

---

### Feature #21 — Ratio (Aspect Ratio Canvas)

**Command:**
```typescript
{ type: 'SET_RATIO', payload: { aspectRatio: '9:16' } }
```

**Processor:** Updates `store.aspectRatio`. WebGL canvas resolution recalculated. All clips' `position_x`/`position_y` preserved as percentage of canvas size. Preview canvas element resizes to maintain aspect ratio within the `PreviewWorkspace` container.

**Presets:** 16:9, 9:16, 1:1, 4:5, 21:9

**AI Tool:** `"change the video format to vertical (9:16)"` or `"switch to square format"`

---

### Feature #22 — Text (Rich Kinetic Typography)

Migrated from existing `useTextElements` hook to Command Pattern:

**Command:**
```typescript
{
  type: 'ADD_TEXT',
  payload: {
    content: 'Hello World',
    font: 'Inter', fontSize: 48, color: '#ffffff',
    bold: false, italic: false, alignment: 'center',
    x: 50, y: 50,               // % of canvas
    start: 0, duration: 3,
    animation: 'fadeIn'          // kinetic animation preset
  }
}
```

**Kinetic animations:** Implemented as keyframe presets auto-applied on add:
- `fadeIn` → opacity keyframes 0→1 over 0.5s
- `slideUp` → position_y keyframes
- `typewriter` → content revealed char-by-char via `clip.metadata.typewriter_progress` keyframe
- `bounce` → scale keyframes with overshoot easing

**AI Tool:** `"add a title at the top saying 'Summer 2024'"` or `"make the text slide up from the bottom"`

---

### Feature #23 — Media (Asset Bin Management)

**Command:**
```typescript
{ type: 'IMPORT_ASSET', payload: { file: File } }
```

**Processor (`media.processor.ts`):**
1. Local preview: `createVideoAsset()` (existing) — creates blob URL + thumbnails
2. Background upload: `POST /api/v1/assets/upload` multipart form to Roxy backend
3. On upload complete: swap blob URL for signed Supabase Storage URL
4. Update `asset.file_url` in local store

**Media Bin UI (`media.ui.tsx`):** Grid of thumbnails. Drag-to-timeline. Filter by type (video/image/audio). Upload progress indicator per asset.

**AI Tool:** `"use the second uploaded video"` or `"add the audio file to the music track"`

---

### Feature #24 — AI Assistant

**Architecture:**

```
User types: "trim the first clip to 5 seconds and add a fade transition"
                              │
                              ▼
          ai-assistant.processor.ts
          ┌──────────────────────────────────────────┐
          │  1. Build system prompt:                  │
          │     - Current timeline state manifest     │
          │     - All 25 tool definitions (JSON Schema)│
          │     - Current playhead position           │
          │     - Selected clip context               │
          │                                           │
          │  2. Call LLM API (Gemini/OpenAI)          │
          │     with tool_calling = true              │
          │                                           │
          │  3. Receive tool_calls array:             │
          │     [{name: "trim_clip", args: {...}},    │
          │      {name: "add_transition", args: {...}}]│
          │                                           │
          │  4. Validate each tool call:              │
          │     - Schema validation (Zod)             │
          │     - Boundary checking (time in range?)  │
          │     - Existence checking (clipId valid?)  │
          │                                           │
          │  5. Convert to EditorCommand[]            │
          │                                           │
          │  6. Dispatch sequentially to Command Bus  │
          └──────────────────────────────────────────┘
                              │
                              ▼
                    Timeline mutated ✅
                    Undo stack updated ✅
                    AI command logged to Supabase ✅
```

**System prompt template (`ai-assistant.tools.ts`):**
```typescript
const buildSystemPrompt = (state: EditorState): string => `
You are Veytrix AI, an intelligent video editing assistant.
You can perform any editing operation by calling the available tools.

Current Timeline State:
- Duration: ${state.duration}s
- Aspect Ratio: ${state.aspectRatio}
- Clips: ${JSON.stringify(getClipManifest(state))}
- Current Time: ${state.currentTime}s
- Selected Clip: ${state.selectedClipId ?? 'none'}

Always call tools to make changes. Never just describe what you would do.
You can call multiple tools in sequence to complete complex requests.
`;
```

**UI (`ai-assistant.ui.tsx`):** Floating panel (right side). Text input + send button. Chat history showing commands applied. "Undo AI Changes" button (dispatches UNDO for each command in last AI batch).

---

## Verification Plan

### Automated Tests

```bash
# Install test runner (add to Phase 0)
npm install -D vitest @testing-library/react

# Run tests
npm run test

# Run specific plugin tests
npm run test -- plugins/split
```

Each plugin must have a `[feature].test.ts` file testing:
1. `execute()` produces correct state mutation
2. `reverse()` produces correct inverse command
3. Applying `execute` then `reverse` returns identical original state

### Manual Verification Per Phase

| Phase | Verify |
|---|---|
| 0 | WebGL canvas shows video, undo/redo buttons visible, Zustand devtools show state |
| 1 | Ctrl+Z undoes split/delete/duplicate; Ctrl+Shift+Z redoes them |
| 2 | 2x speed clip plays at double speed; reversed clip plays backwards |
| 3 | PIP clip visible in preview; keyframe opacity animates correctly |
| 4 | Muted clip produces no audio; BGM volume slider works |
| 5 | Teal&Orange filter visually changes preview colors; captions appear on video |
| 6 | Type "split the first clip in half" → clip splits at midpoint in timeline |

---

## Merge Strategy: Editor_Screen → Roxy_new

Since `D:\Roxy_new` uses Python FastAPI as backend:

1. `Editor_Screen` is self-contained (Vite + React + Zustand)
2. API calls from `Editor_Screen` already target Roxy's endpoints (`/api/v1/...`)
3. Merge = copy the entire `editor screen/` folder into `Roxy_new`'s frontend directory
4. Update base URL constant to point to Roxy's FastAPI host
5. No backend changes needed — Roxy's API contract is already compatible with the `ClipModel` / `TimelineModel` schema defined in this plan

```typescript
// editor screen/store/editor.store.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
```

Set `VITE_API_BASE_URL=https://your-roxy-api.com` in production `.env`.
