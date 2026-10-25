import { EditorCommand } from "../../types/command.types";
import { AspectRatio } from "../../types/editor.types";

export function createSetRatioCommand(aspectRatio: AspectRatio): EditorCommand {
  return {
    id: `rat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "SET_RATIO",
    payload: {
      aspectRatio,
    },
    timestamp: Date.now(),
  };
}
