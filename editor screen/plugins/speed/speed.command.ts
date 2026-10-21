import { EditorCommand } from "../../types/command.types";

export interface SetSpeedPayload {
  clipId: string;
  speed: number;
}

export function createSetSpeedCommand(
  clipId: string,
  speed: number
): EditorCommand {
  return {
    id: `spd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "SET_SPEED",
    payload: {
      clipId,
      speed,
    },
    timestamp: Date.now(),
  };
}
