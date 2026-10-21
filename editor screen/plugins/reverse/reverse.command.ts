import { EditorCommand } from "../../types/command.types";

export interface ReverseClipPayload {
  clipId: string;
}

export function createReverseCommand(clipId: string): EditorCommand {
  return {
    id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "REVERSE_CLIP",
    payload: { clipId },
    timestamp: Date.now(),
  };
}
