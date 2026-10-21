import { EditorCommand } from "../../types/command.types";

export interface SplitClipPayload {
  clipId: string;
  splitTime: number;
  newClipId: string;
}

export function createSplitCommand(
  clipId: string,
  splitTime: number,
  newClipId?: string
): EditorCommand {
  return {
    id: `split-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "SPLIT_CLIP",
    payload: {
      clipId,
      splitTime,
      newClipId:
        newClipId ||
        `clip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    },
    timestamp: Date.now(),
  };
}
