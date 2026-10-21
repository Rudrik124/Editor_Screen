# Veytrix Video Editor: Architecture and Command Audit

**Audit type:** Read-only codebase audit  
**Scope:** Current working tree at `C:\Users\Rudrik Joshi\Downloads\Editor_Screen`  
**Source of truth:** TypeScript, Python, SQL, configuration, and tests currently present in the repository  
**Generated:** 2026-10-21

## 1. Executive summary

Veytrix is a browser-based React 18/Vite editor with:

- A UI organized around an editor shell, media library, preview, inspector, playback bar, and timeline.
- Zustand state in `editor screen/store/editor.store.ts`.
- A command bus implemented by `dispatch` plus `executeCommandMutation`.
- Feature modules under `editor screen/plugins/`; most clip commands follow a UI -> processor -> command -> mutation path.
- A FastAPI backend under `backend/app/`.
- Local media processing in the browser for initial asset metadata/thumbnails, and server-side FFmpeg compilation/export for submitted timelines.
- Optional Supabase persistence and authentication integration.
- A SQL migration for richer tracks, clips, keyframes, and AI command audit records.

The frontend currently edits in-memory state by default. The backend persistence and render APIs exist, but the main editor shell does not automatically load/save a project or submit exports without the relevant UI integration. The backend has a local in-memory persistence fallback and a background render queue.

### Highest-impact architectural gaps

1. **Frontend/backend asset flows are separate.** Browser upload uses `URL.createObjectURL`; `backendApi.ts` has no asset-upload function. A browser-created blob URL cannot be used by a later server render process.
2. **Project persistence is not wired into `VeytrixEditor`.** Save/load service functions exist, but no editor lifecycle currently calls them.
3. **Export integration is partial.** `ExportModal` exists and render service functions exist, but the audit found no complete path from the editor shell to a submitted render job and download lifecycle.
4. **Backend auth intentionally has a guest/unverified development fallback.** This is acceptable only for local development; production must require verified JWTs.
5. **Supabase relational persistence is incomplete.** `TimelineRepository.save_timeline` inserts tracks but does not insert the requested clips or keyframes after deleting them.
6. **The migration schema and Pydantic schema use different representations.** The migration uses `start_time/end_time/playback_speed`, while API models use `start/duration/speed`.
7. **There is no AI/NL command interpreter.** The database contains an AI audit-log table, but no parser, API route, executor, or frontend command entry point was found.

## 2. Actual repository structure

Generated/dependency directories (`node_modules`, `dist`, `.git`, `backend/.venv`, caches, and backend storage media) are intentionally omitted.

```text
.
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── src/
│   └── main.tsx
├── editor screen/
│   ├── VeytrixEditor.tsx
│   ├── data/
│   │   └── editorMockData.ts
│   ├── types/
│   │   ├── editor.types.ts
│   │   └── command.types.ts
│   ├── store/
│   │   ├── editor.store.ts
│   │   ├── command.bus.ts
│   │   ├── command.executor.ts
│   │   ├── clip.mutations.ts
│   │   ├── gap.mutations.ts
│   │   ├── phase2.mutations.ts
│   │   ├── property.mutations.ts
│   │   ├── sanitize.ts
│   │   └── store.selectors.ts
│   ├── hooks/
│   │   ├── useCommand.ts
│   │   ├── useEditorKeyboardShortcuts.ts
│   │   └── useEditorStore.ts
│   ├── components/
│   │   ├── EditorHeader.tsx
│   │   ├── MediaLibrary.tsx
│   │   ├── PreviewWorkspace.tsx
│   │   ├── PlaybackBar.tsx
│   │   ├── RightInspector.tsx
│   │   ├── TimelineToolbar.tsx
│   │   ├── TimelineWorkspace.tsx
│   │   ├── TimelineTrack.tsx
│   │   ├── TimelineClip.tsx
│   │   ├── ClipContextMenu.tsx
│   │   ├── ExportModal.tsx
│   │   ├── EditorToolIcons.tsx
│   │   └── utils/formatVideoTime.ts
│   ├── left-side toolbar/
│   │   ├── LeftSideToolbar.tsx
│   │   └── functionality/
│   │       ├── Video/
│   │       ├── Audio/
│   │       ├── Overlay/
│   │       ├── music/
│   │       └── text/
│   ├── bottom tool bar/
│   │   ├── BottomToolbar.tsx
│   │   └── functionality/icon1..icon14/
│   ├── plugins/
│   │   ├── split/
│   │   ├── trim/
│   │   ├── speed/
│   │   ├── reverse/
│   │   ├── freeze/
│   │   ├── duplicate/
│   │   ├── delete/
│   │   ├── rename/
│   │   ├── lock/
│   │   └── undo-redo/
│   ├── renderer/
│   │   ├── frame.scheduler.ts
│   │   ├── webgl.renderer.ts
│   │   └── webgl.shaders.ts
│   ├── services/backendApi.ts
│   └── styles/
├── backend/
│   ├── run.py
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── api/v1/
│   │   ├── core/
│   │   ├── db/
│   │   ├── engine/
│   │   ├── queue/
│   │   ├── runners/
│   │   └── schemas/
│   └── tests/
└── supabase/
    └── migrations/20261020_editor_features.sql
```

### Frontend responsibilities

`VeytrixEditor.tsx` is the composition root. It owns browser media state and connects the editor store to the workspace components. `components/` contains UI and interaction wiring. `plugins/` contains feature-specific command factories, processors, state selectors, and toolbar UI. `store/` owns canonical timeline state and mutations. `renderer/` contains WebGL/frame-scheduling primitives, but the visible preview currently uses HTML video/image elements in `PreviewWorkspace.tsx`.

The left toolbar contains media/text entry points. The bottom toolbar contains clip-editing commands. The separate `bottom tool bar/functionality/icon1..icon14` tree is present, but the current `BottomToolbar.tsx` imports the plugin buttons rather than those numbered functionality components.

### Backend responsibilities

- `api/v1/assets.py`: chunked upload, extension validation, filename sanitization, FFmpeg probe.
- `api/v1/timeline.py`: authenticated save/load endpoints.
- `api/v1/render.py`: render submission, status, safe download, progress WebSocket.
- `core/`: settings, JWT/guest identity, path and URL security.
- `schemas/`: Pydantic request/response and timeline models.
- `engine/`: timeline compiler and FFmpeg filter/plugin model.
- `queue/`: asynchronous render jobs and WebSocket broadcasting.
- `runners/`: FFmpeg subprocess and media probing.
- `db/`: Supabase client, export persistence, timeline persistence with local fallback.

## 3. Runtime data flows

### Browser editing flow

```text
User selects/imports a file
  -> MediaLibrary / createVideoAsset
  -> browser File/URL.createObjectURL
  -> VeytrixEditor.addAssetClipToStore
  -> editor.store.dispatch(ADD_CLIP)
  -> clip.mutations.handleAddClip
  -> TimelineWorkspace/TimelineClip render
  -> PreviewWorkspace resolves video clip by playhead
```

The browser path creates a local object URL. It does not call `POST /api/v1/assets/upload`.

### Command flow

```text
Toolbar/context menu/keyboard shortcut
  -> plugin UI or hook
  -> plugin processor
  -> command factory
  -> useEditorStore.getState().dispatch
  -> command.executor
  -> mutation module
  -> immutable clips/tracks update
  -> Zustand subscribers rerender timeline/preview/inspector
```

Commands are local and synchronous from the UI’s perspective. There is no automatic command persistence or server synchronization in the dispatcher.

### Preview flow

`PreviewWorkspace.tsx` finds the video clip around `currentTime`, maps timeline time to source time using `inPoint`, `speed`, `reverse`, and freeze fields, and synchronizes an HTML `<video>`. Playback advances the Zustand playhead through `requestAnimationFrame`; the media element is a follower of the timeline clock.

### Server render flow

```text
Frontend submitTimelineRender
  -> POST /api/v1/render
  -> render.create_render_job
  -> JobQueue.submit_render
  -> asyncio background task
  -> TimelineCompiler.compile
  -> FFmpegRunner.run
  -> ExportRepository updates status/progress
  -> ws_manager broadcasts ProgressMessage
  -> frontend WebSocket subscription
  -> GET /download after completion
```

The frontend payload maps camelCase fields into the backend Pydantic models, but media URLs must be resolvable by the backend render process. Browser object URLs are not server-resolvable.

## 4. Command implementation register

| Command/feature | Entry point | Processor/factory | Mutation | Current status and limitations |
|---|---|---|---|---|
| Import video | `MediaLibrary` file selection; left Video functionality | `createVideoAsset.ts`; direct `ADD_CLIP` dispatch in `VeytrixEditor.tsx` | `clip.mutations.handleAddClip` | Browser-local import works. Backend upload is not wired. |
| Add existing video to timeline | Media library asset action | `addVideoToTimeline` / `addAssetClipToStore` | `handleAddClip` | Implemented in local store. |
| Select clip | `TimelineClip` pointer/click; context menu | `TimelineWorkspace` -> `selectClip` | Zustand action `selectClip` | Implemented. Preview media sync follows selected clip. |
| Move clip | `TimelineClip.beginDragMove` | Direct `MOVE_CLIP` dispatch | `gap.mutations.handleMoveClip` | Implemented with magnetic snapping to another clip end. No full collision/track-transfer model. |
| Trim left/right | `TrimToolbarButton`, `TimelineClip` handles, context menu | `trim.processor.ts`, `trim.command.ts` | `phase2.mutations.handleTrimClip` | Implemented with minimum duration and in/out updates. Pointer drag uses preview style mutation then final command. |
| Split | `SplitToolbarButton`, keyboard `S` | `split.processor.ts`, `split.command.ts` | `clip.mutations.handleSplitClip` | Implemented locally. |
| Duplicate | Bottom toolbar/context menu | `duplicate.processor.ts`, `duplicate.command.ts` | `handleDuplicateClip` | Implemented locally. |
| Delete | Bottom toolbar/context menu/`Delete` shortcut | `delete.processor.ts`, `delete.command.ts` | `handleDeleteClip` | Implemented. Ripple behavior is separate and not generally automatic. |
| Ripple/close gap | Command infrastructure and gap mutations | `gap.mutations.handleCloseGap` | `CLOSE_GAP` | Mutation exists; no clearly connected primary UI entry point was found. |
| Playback speed | Speed toolbar button | `speed.processor.ts`, `speed.command.ts` | `handleSetSpeed` | Implemented. Clamps 0.1-4.0 in frontend mutation; duration is recalculated from `baseDuration`. |
| Reverse | Bottom toolbar | `reverse.processor.ts`, `reverse.command.ts` | `handleReverseClip` | Implemented as a clip flag. Preview seeks manually for reverse; FFmpeg plugin support exists server-side. |
| Freeze frame | Bottom toolbar | `freeze.processor.ts`, `freeze.command.ts` | `handleFreezeClip` / restore | Implemented by splitting into left/freeze/right clips. Requires playhead inside clip. |
| Rename | Bottom toolbar/context menu | `rename.processor.ts`, `rename.command.ts` | `property.mutations.handleRenameClip` | Implemented with `sanitizeClipName`. |
| Lock/unlock | Bottom toolbar/context menu | `lock.processor.ts`, `lock.command.ts` | `handleLockClip` / `handleUnlockClip` | Implemented. Most processors reject locked clips. |
| Undo/redo | Header buttons and keyboard shortcuts | `editor.store.undo/redo`; undo-redo plugin | Replays inverse commands | Implemented for commands that provide inverses. |
| Play/pause | `PlaybackBar` | `PreviewWorkspace.togglePlayback` | `setIsPlaying` | Implemented with RAF master clock. |
| Seek/playhead | Playback controls and timeline click | `TimelineWorkspace.handleTimelineClick` | `setCurrentTime` | Implemented; click mapping uses fixed ruler offsets. |
| Track management | Timeline rendering | `editor.store` initial tracks | No general track command | Default tracks exist. Creation, deletion, reorder, visibility, and mute UI are not complete. |
| Text create/select/edit | Left Text toolbar and `useTextElements` | Text hook/local handlers | Text state hook plus selected clip bridge | Implemented for basic text. Full command-bus and export integration are incomplete. |
| Audio/music | Left toolbar and default tracks | UI scaffolding | No complete editor command path | Default music/audio tracks exist; import, waveform, detach, and effects are not complete. |
| Export | `ExportModal` and backend service | `submitTimelineRender` | Backend queue/compiler | Backend path exists; complete editor-to-modal submission wiring needs verification/integration. |

## 5. Text, audio, and advanced features

### Text

The left toolbar’s text panel and `useTextElements` manage text elements with content, timing, color, position, and presentation width. `TimelineWorkspace` converts them into text timeline clips and supports edge resizing through `VeytrixEditor.resizeText`. `PreviewWorkspace` draws active text overlays over the preview.

The backend schema includes `textData`, and the compiler has a text/subtitle plugin module. The current frontend text element model and backend export payload are not shown to be fully bridged, so preview text and rendered export text should be treated as separate integration points until an end-to-end export test confirms parity.

### Audio and music

The frontend has music/audio tracks and toolbar scaffolding. Backend schemas include volume and the engine includes audio plugins. The current audit did not find a complete browser audio waveform/editor pipeline, detach-audio command, or connected volume/mute controls in the primary editor shell.

### Effects, filters, transitions, and keyframes

Backend schemas, compiler models, and plugin modules define extension points for these features. The frontend `ClipModel` carries some related fields, but the primary UI does not expose a complete command/register for all of them. These should be considered backend/schema-ready rather than end-to-end implemented.

### AI/NL commands

No parser, prompt endpoint, command interpreter, or frontend natural-language command UI was found. `ai_command_log` in the Supabase migration is only a persistence schema for a future feature.

## 6. Backend API register

| Method | Route | Handler | Behavior |
|---|---|---|---|
| GET | `/` | `app.main.root` | Returns app/version/docs/health links. |
| GET | `/api/v1/health` | `health.get_health` | Reports FFmpeg availability and storage capacity. |
| POST | `/api/v1/assets/upload` | `assets.upload_asset` | Streams upload, validates extension/size, probes media, returns metadata. |
| POST | `/api/v1/timeline/save` | `timeline.save_timeline_state` | Saves local fallback and optionally Supabase state. |
| GET | `/api/v1/timeline/{project_id}` | `timeline.load_timeline_state` | Loads local fallback or Supabase project timeline. |
| POST | `/api/v1/render` | `render.create_render_job` | Authenticated render submission to background queue. |
| GET | `/api/v1/render/jobs/{job_id}` | `render.get_job_status` | Returns persisted job state. |
| GET | `/api/v1/render/jobs/{job_id}/download` | `render.download_rendered_video` | Safely serves a completed export. |
| WS | `/api/v1/render/jobs/{job_id}/ws` | `render.websocket_render_progress` | Receives live job broadcasts. |

The frontend API base is hard-coded to `http://localhost:8000/api/v1` and the WebSocket base to `ws://localhost:8000/api/v1`; there is no environment-based frontend API configuration.

## 7. Persistence, authentication, and security

`core/security.py` provides extension validation, filename sanitization, safe path resolution, and remote URL SSRF checks. `core/dependencies.py` validates Supabase JWTs when `SUPABASE_JWT_SECRET` is configured. Without that secret, a Bearer token is decoded without verification; without a token, all callers become a shared guest UUID. This must not be used as a production authentication policy.

`TimelineRepository` always writes an in-memory project copy. If Supabase is configured, it upserts project JSON and replaces relational tracks. It currently deletes `timeline_clips` but does not insert replacement clips, so the relational clip tables cannot reflect the submitted timeline. Errors are logged but return success because the local fallback has been updated.

The migration enables RLS on new tables and provides ownership policies. It assumes `projects` and `assets` already exist. The migration’s UUID foreign keys and relational field names differ from the JSON/Pydantic model representation; an explicit mapping layer is required.

## 8. FFmpeg/rendering architecture

`TimelineCompiler` builds FFmpeg inputs/filter nodes from `TimelineExportRequest`. `engine/plugins/` contains modules for audio, effects, color filters, text/subtitles, transitions, trim/speed. `FFmpegRunner` executes the generated command and reports progress. `ProbeRunner` extracts media metadata for uploaded assets.

The queue uses a global semaphore plus per-user counters. Jobs are stored through `ExportRepository`; progress is broadcast through `ConnectionManager`. Background tasks are process-local, so a multi-worker deployment would require a shared queue/store and shared progress channel.

## 9. Tests and validation

Backend tests present:

- `test_compiler.py`: compiler/render argument behavior.
- `test_persistence.py`: persistence behavior.
- `test_render_e2e.py`: render flow.
- `test_security.py`: path traversal, SSRF, filename, and extension checks.
- `test_timeline_schemas.py`: Pydantic validation.

Frontend package scripts provide `dev`, `build`, and `preview`; there is no frontend test script or test directory. The current TypeScript/Vite build passes in the audited working tree. No repository-level architecture documentation or diagram was present before this report.

## 10. Recommended future integration plan

1. Introduce a frontend runtime configuration for API/WS URLs.
2. Make browser import call `/assets/upload`, retain the returned server asset identity, and use backend-resolvable media paths for exports.
3. Add a project/session ID to the editor shell and wire debounced save/load to `saveProjectTimeline`/`loadProjectTimeline`.
4. Complete `TimelineRepository` relational writes for clips/keyframes or explicitly choose JSON-only persistence.
5. Define one canonical timeline DTO and map it at the frontend/backend boundary; resolve camelCase versus SQL snake_case deliberately.
6. Complete the export modal -> render submission -> WebSocket -> download path with an end-to-end test using a backend-uploaded asset.
7. Replace guest/unverified JWT fallback with an explicit development-only flag and fail closed in production.
8. Add frontend tests for command mutations, selection/active-clip rules, preview time mapping, and toolbar enablement.
9. Add track commands (create/delete/reorder/visibility/mute/lock) before exposing advanced multi-track UI.
10. Add integration tests that verify speed, reverse, freeze, trims, text, filters, transitions, and audio survive save/load and server export.
11. If AI commands are added, validate parsed commands against the same `EditorCommand` schema and persist audit records only after authorization.

## 11. Best extension points

- **New local editing command:** add a command type in `types/command.types.ts`, a command factory/processor in the relevant `plugins/<feature>/`, a mutation in `store/`, and an inverse for undo.
- **New toolbar action:** add a plugin UI and export it through the plugin `index.ts`; compose it in `BottomToolbar.tsx` or the appropriate toolbar.
- **New preview behavior:** update the active clip/source-time calculation in `PreviewWorkspace.tsx`, then add an equivalent compiler/plugin implementation for export parity.
- **New export capability:** extend `schemas/timeline.py`, add or update an engine plugin/compiler path, then add a frontend payload mapping and render test.
- **New persistence field:** update frontend types, API schemas, Supabase JSON/relational mapping, migration if needed, and save/load tests together.
- **New authenticated resource:** add a dependency-protected API route, repository method, ownership check/RLS policy, frontend service method, and an integration test.

