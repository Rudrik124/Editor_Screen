import { EditorCommand } from "../../types/command.types";
import { KeyframeData } from "../../types/editor.types";

export function createAddKeyframeCommand(
  clipId: string,
  keyframe: KeyframeData
): EditorCommand {
  return {
    id: `kf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "ADD_KEYFRAME",
    payload: {
      clipId,
      keyframe,
    },
    timestamp: Date.now(),
  };
}

export function createRemoveKeyframeCommand(
  clipId: string,
  keyframeId: string
): EditorCommand {
  return {
    id: `rm-kf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "REMOVE_KEYFRAME",
    payload: {
      clipId,
      keyframeId,
    },
    timestamp: Date.now(),
  };
}
