import { EditorCommand } from "../../types/command.types";
import { TransitionData } from "../../types/editor.types";

export function createAddTransitionCommand(
  clipId: string,
  transition: TransitionData
): EditorCommand {
  return {
    id: `trans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "ADD_TRANSITION",
    payload: {
      clipId,
      transition,
    },
    timestamp: Date.now(),
  };
}

export function createRemoveTransitionCommand(clipId: string): EditorCommand {
  return {
    id: `rm-trans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "REMOVE_TRANSITION",
    payload: {
      clipId,
    },
    timestamp: Date.now(),
  };
}
