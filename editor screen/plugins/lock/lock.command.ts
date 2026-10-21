import { EditorCommand } from "../../types/command.types";

export interface LockClipPayload {
  clipId: string;
}

export function createLockCommand(clipId: string): EditorCommand {
  return {
    id: `lock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "LOCK_CLIP",
    payload: { clipId },
    timestamp: Date.now(),
  };
}

export function createUnlockCommand(clipId: string): EditorCommand {
  return {
    id: `unlock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "UNLOCK_CLIP",
    payload: { clipId },
    timestamp: Date.now(),
  };
}
