import { useEditorStore } from "../../store/editor.store";

export function useOverlapState(clipId: string | null) {
  const clip = useEditorStore((state) => (clipId ? state.clips[clipId] : null));
  const tracks = useEditorStore((state) => state.tracks);
  const currentTrack = tracks.find((t) => t.id === clip?.trackId);

  return {
    clip,
    currentTrack,
    scale: clip?.scale ?? 1.0,
    positionX: clip?.positionX ?? 0,
    positionY: clip?.positionY ?? 0,
    rotation: clip?.rotation ?? 0,
    opacity: clip?.opacity ?? 1.0,
    canEdit: Boolean(clip && !clip.locked),
  };
}
