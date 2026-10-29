import { EditorCommand } from "../../types/command.types";

export function createAudioCommand(
  type: "EXTRACT_AUDIO" | "SET_AUDIO_VOLUME" | "MUTE_CLIP" | "MUTE_TRACK",
  payload: Record<string, unknown>
): EditorCommand {
  return {
    id: `audio-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
  };
}
