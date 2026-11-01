import { EditorCommand } from "../types/command.types";
import { TimelineStateSlice } from "./clip.mutations";

export function handleSetFilters(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, filters } = command.payload as {
    clipId: string;
    filters: Array<{ type: string; intensity?: number }>;
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked) return null;

  const previousFilters = clip.filters || [];

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "SET_FILTERS",
    payload: {
      clipId,
      filters: previousFilters,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: {
          ...clip,
          filters,
        },
      },
    },
    inverse,
  };
}

export function handleSetEffects(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, effects } = command.payload as {
    clipId: string;
    effects: Array<{ type: string; parameters?: Record<string, any> }>;
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked) return null;

  const previousEffects = clip.effects || [];

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "SET_EFFECTS",
    payload: {
      clipId,
      effects: previousEffects,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: {
          ...clip,
          effects,
        },
      },
    },
    inverse,
  };
}

