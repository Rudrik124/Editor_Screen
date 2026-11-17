import { RatioProcessor } from "../../../../plugins/ratio";
import { useEditorStore } from "../../../../store/editor.store";
import { TextElement } from "./text.types";
import { TextData } from "../../../../types/editor.types";

export function useTextElements() {
  const clips = useEditorStore(state => state.clips);
  const selectedId = useEditorStore(state => state.selectedClipId) ?? undefined;
  const elements: TextElement[] = Object.values(clips).filter(c => c.type === "text").map(c => ({
    id: c.id, content: c.text_data?.text ?? c.content ?? c.name,
    fontSize: c.text_data?.fontSize ?? 32, color: c.text_data?.color ?? "#ffffff",
    bold: c.text_data?.bold ?? false, italic: c.text_data?.italic ?? false,
    alignment: c.text_data?.alignment ?? "center", x: c.text_data?.x ?? 50, y: c.text_data?.y ?? 50,
    neon: c.text_data?.preset === "neon", start: c.start, duration: c.duration,
  }));
  const setSelectedId = (id: string | undefined) => useEditorStore.getState().selectClip(id ?? null);
  const add = (preset?: "neon") => {
    const state = useEditorStore.getState();
    const track = state.tracks.find(t => t.type === "text");
    if (!track || track.locked) return;
    const id = `text-${crypto.randomUUID()}`;
    state.dispatch({ id: `add-${id}`, type: "ADD_CLIP", timestamp: Date.now(), payload: {
      trackId: track.id, clip: { id, trackId: track.id, name: "Text", type: "text", start: state.currentTime,
        duration: 3, text_data: { referenceWidth: RatioProcessor.getDimensions(state.aspectRatio).width, text: "Text", fontSize: 32, color: preset === "neon" ? "#00e5ff" : "#ffffff", x: 50, y: 50, alignment: "center", preset: preset ?? "none" } },
    } });
  };
  const update = (id: string, changes: Partial<TextElement>) => {
    const state = useEditorStore.getState();
    const clip = state.clips[id];
    if (!clip) return;
    const data: TextData = { ...clip.text_data, text: changes.content ?? clip.text_data?.text ?? clip.content ?? clip.name };
    for (const key of ["fontSize", "color", "bold", "italic", "alignment", "x", "y"] as const) {
      if (changes[key] !== undefined) Object.assign(data, { [key]: changes[key] });
    }
    if (changes.neon !== undefined) data.preset = changes.neon ? "neon" : "none";
    state.dispatch({ id: `text-${crypto.randomUUID()}`, type: "UPDATE_TEXT", timestamp: Date.now(),
      payload: { clipId: id, textData: data, start: changes.start ?? clip.start, duration: changes.duration ?? clip.duration } });
  };
  const remove = (id: string) => {
    const state = useEditorStore.getState();
    state.dispatch({ id: `delete-${crypto.randomUUID()}`, type: "DELETE_CLIP", timestamp: Date.now(), payload: { clipId: id } });
  };
  return { elements, selectedId, setSelectedId, add, update, remove };
}
