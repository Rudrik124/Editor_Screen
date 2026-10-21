import { EditorCommand } from "../types/command.types";
import { TimelineStateSlice } from "./clip.mutations";
import { sanitizeClipName } from "./sanitize";

export function handleRenameClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, newName, oldName } = command.payload as {
    clipId: string;
    newName: string;
    oldName?: string;
  };
  const clip = state.clips[clipId];
  if (!clip) return null;
  if (clip.locked) {
    console.warn(`Operation rejected: clip "${clip.name}" is locked.`);
    return null;
  }

  const sanitized = sanitizeClipName(newName);
  const previousName = oldName ?? clip.name;

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "RENAME_CLIP",
    payload: {
      clipId,
      newName: previousName,
      oldName: sanitized,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: {
          ...clip,
          name: sanitized,
        },
      },
    },
    inverse,
  };
}

export function handleLockClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId } = command.payload as { clipId: string };
  const clip = state.clips[clipId];
  if (!clip) return null;

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "UNLOCK_CLIP",
    payload: { clipId },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: { ...clip, locked: true },
      },
    },
    inverse,
  };
}

export function handleUnlockClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId } = command.payload as { clipId: string };
  const clip = state.clips[clipId];
  if (!clip) return null;

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "LOCK_CLIP",
    payload: { clipId },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: { ...clip, locked: false },
      },
    },
    inverse,
  };
}
