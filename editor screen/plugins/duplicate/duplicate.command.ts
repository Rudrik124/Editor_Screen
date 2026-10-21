import { EditorCommand } from "../../types/command.types";

export interface DuplicateClipPayload {
  originalClipId: string;
  newClipId: string;
}

export function createDuplicateCommand(
  originalClipId: string,
  newClipId?: string
): EditorCommand {
  return {
    id: `dup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "DUPLICATE_CLIP",
    payload: {
      originalClipId,
      newClipId:
        newClipId ||
        `clip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    },
    timestamp: Date.now(),
  };
}
