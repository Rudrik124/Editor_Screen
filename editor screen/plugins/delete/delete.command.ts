import { EditorCommand } from "../../types/command.types";

export interface DeleteClipPayload {
  clipId: string;
  trackId?: string;
}

export function createDeleteCommand(
  clipId: string,
  trackId?: string
): EditorCommand {
  return {
    id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "DELETE_CLIP",
    payload: {
      clipId,
      trackId,
    },
    timestamp: Date.now(),
  };
}
