import { ClipModel } from "../types/editor.types";
import { EditorCommand } from "../types/command.types";
import { TimelineStateSlice } from "./clip.mutations";

export function handleCloseGap(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { trackId, gapStart, gapDuration } = command.payload as {
    trackId: string;
    gapStart: number;
    gapDuration: number;
  };

  const track = state.tracks.find((t) => t.id === trackId);
  if (!track || track.locked) return null;

  const newClips = { ...state.clips };
  const shiftedClips: { id: string; oldStart: number; newStart: number }[] = [];

  for (const cid of track.clipIds) {
    const clip = newClips[cid];
    if (clip && clip.start >= gapStart - 0.05) {
      const newStart = Math.max(0, clip.start - gapDuration);
      shiftedClips.push({ id: cid, oldStart: clip.start, newStart });
      newClips[cid] = {
        ...clip,
        start: newStart,
      };
    }
  }

  if (shiftedClips.length === 0) return null;

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "CLOSE_GAP",
    payload: {
      trackId,
      gapStart,
      gapDuration: -gapDuration,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: newClips,
    },
    inverse,
  };
}

export function handleMoveClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, newStart } = command.payload as {
    clipId: string;
    newStart: number;
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked) return null;

  const oldStart = clip.start;
  const updatedClip: ClipModel = {
    ...clip,
    start: Math.max(0, newStart),
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "MOVE_CLIP",
    payload: {
      clipId,
      newStart: oldStart,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: updatedClip,
      },
    },
    inverse,
  };
}
