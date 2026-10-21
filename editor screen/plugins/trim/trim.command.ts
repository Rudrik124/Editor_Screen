import { EditorCommand } from "../../types/command.types";

export interface TrimClipPayload {
  clipId: string;
  edge: "left" | "right";
  newTime: number;
}

export function createTrimCommand(
  clipId: string,
  edge: "left" | "right",
  newTime: number
): EditorCommand {
  return {
    id: `trim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "TRIM_CLIP",
    payload: {
      clipId,
      edge,
      newTime,
    },
    timestamp: Date.now(),
  };
}
