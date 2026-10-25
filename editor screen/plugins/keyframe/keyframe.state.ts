import { useEditorStore } from "../../store/editor.store";

export function useKeyframeState(clipId: string | null) {
  const clip = useEditorStore((state) => (clipId ? state.clips[clipId] : null));
  const currentTime = useEditorStore((state) => state.currentTime);

  const keyframes = clip?.keyframes || [];
  const localTime = clip ? Math.max(0, Math.min(clip.duration, currentTime - clip.start)) : 0;
  const canEdit = Boolean(clip && !clip.locked);

  return {
    clip,
    keyframes,
    currentTime,
    localTime,
    canEdit,
  };
}
