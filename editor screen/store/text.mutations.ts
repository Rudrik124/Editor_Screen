import { EditorCommand } from "../types/command.types";
import { TextData } from "../types/editor.types";
import { TimelineStateSlice } from "./clip.mutations";

export function handleUpdateText(state: TimelineStateSlice, command: EditorCommand) {
  const { clipId, textData, start, duration } = command.payload as {
    clipId: string; textData: TextData; start: number; duration: number;
  };
  const clip = state.clips[clipId];
  if (!clip || clip.type !== "text" || clip.locked || state.tracks.find(t => t.id === clip.trackId)?.locked) return null;
  if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration < 0.1) return null;
  if (![textData.x ?? 50, textData.y ?? 50, textData.fontSize ?? 32].every(Number.isFinite)) return null;
  return {
    newState: { clips: { ...state.clips, [clipId]: { ...clip, start, duration, text_data: textData } } },
    inverse: { id: `inv-${command.id}`, type: "UPDATE_TEXT" as const,
      payload: { clipId, textData: clip.text_data ?? { text: clip.content ?? clip.name }, start: clip.start, duration: clip.duration }, timestamp: Date.now() },
  };
}
