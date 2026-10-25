import { EditorCommand } from "../../types/command.types";

export function createSetCoverCommand(
  coverUrl: string,
  clipId?: string
): EditorCommand {
  return {
    id: `cov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "SET_COVER",
    payload: {
      clipId,
      coverUrl,
    },
    timestamp: Date.now(),
  };
}
