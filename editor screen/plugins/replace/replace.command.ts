import { EditorCommand } from "../../types/command.types";

export interface ReplaceClipPayload {
  clipId: string;
  newMediaUrl: string;
  newAssetId?: string;
  newName?: string;
  newDuration?: number;
  newThumbnails?: string[];
}

export function createReplaceClipCommand(payload: ReplaceClipPayload): EditorCommand {
  return {
    id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "REPLACE_CLIP",
    payload: { ...payload },
    timestamp: Date.now(),
  };
}
