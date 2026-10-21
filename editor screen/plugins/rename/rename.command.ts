import { EditorCommand } from "../../types/command.types";

export interface RenameClipPayload {
  clipId: string;
  newName: string;
  oldName?: string;
}

export function createRenameCommand(
  clipId: string,
  newName: string,
  oldName?: string
): EditorCommand {
  return {
    id: `ren-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "RENAME_CLIP",
    payload: {
      clipId,
      newName,
      oldName,
    },
    timestamp: Date.now(),
  };
}
