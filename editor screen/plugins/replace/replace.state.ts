import { useEditorStore } from "../../store/editor.store";

export function useReplaceState(clipId: string | null) {
  const clip = useEditorStore((state) => (clipId ? state.clips[clipId] : null));
  const canReplace = Boolean(clip && !clip.locked);

  return { clip, canReplace };
}
