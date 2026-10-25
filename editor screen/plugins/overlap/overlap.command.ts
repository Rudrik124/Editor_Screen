import { EditorCommand } from "../../types/command.types";

export interface SetOverlapPayload {
  clipId: string;
  trackId: string;
  scale?: number;
  positionX?: number;
  positionY?: number;
}

export interface SetClipTransformPayload {
  clipId: string;
  scale?: number;
  positionX?: number;
  positionY?: number;
  rotation?: number;
  opacity?: number;
}

export function createSetOverlapCommand(payload: SetOverlapPayload): EditorCommand {
  return {
    id: `ovl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "SET_OVERLAP",
    payload: { ...payload },
    timestamp: Date.now(),
  };
}

export function createSetClipTransformCommand(
  payload: SetClipTransformPayload
): EditorCommand {
  return {
    id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "SET_CLIP_TRANSFORM",
    payload: { ...payload },
    timestamp: Date.now(),
  };
}
