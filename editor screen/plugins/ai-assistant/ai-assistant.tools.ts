import { ClipModel, TrackModel } from "../../types/editor.types";

export interface TimelineStateManifest {
  duration: number;
  currentTime: number;
  aspectRatio: string;
  selectedClipId: string | null;
  tracks: TrackModel[];
  clips: Record<string, ClipModel>;
}

export function getClipManifest(state: TimelineStateManifest): any[] {
  const clips = Object.values(state.clips || {});
  return clips.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    start: c.start,
    duration: c.duration,
    speed: c.speed ?? 1.0,
    volume: c.volume ?? 1.0,
    muted: c.muted ?? false,
    locked: c.locked ?? false,
    transition: c.transition?.type ?? null,
  }));
}

export const buildSystemPrompt = (state: TimelineStateManifest): string => `
You are Veytrix AI, an intelligent video editing assistant.
You can perform any editing operation by calling the available tools.

Current Timeline State:
- Duration: ${state.duration}s
- Aspect Ratio: ${state.aspectRatio}
- Clips: ${JSON.stringify(getClipManifest(state))}
- Current Time: ${state.currentTime}s
- Selected Clip: ${state.selectedClipId ?? "none"}

Always call tools to make changes. Never just describe what you would do.
You can call multiple tools in sequence to complete complex requests.
`;
