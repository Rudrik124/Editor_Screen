import { useEditorStore } from "../../store/editor.store";
import { TransitionData } from "../../types/editor.types";

export function useTransitionState(clipId: string | null) {
  const clip = useEditorStore((state) => (clipId ? state.clips[clipId] : null));
  const transition = clip?.transition as TransitionData | undefined;
  const canEdit = Boolean(clip && !clip.locked);

  return {
    clip,
    transition,
    canEdit,
  };
}
