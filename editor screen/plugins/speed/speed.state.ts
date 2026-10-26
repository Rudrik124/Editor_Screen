import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";

export function useSpeedState() {
  const selectedClip = useEditorStore(selectToolbarClip);
  const currentSpeed = selectedClip?.speed ?? 1.0;
  const canSetSpeed = Boolean(selectedClip && !selectedClip.locked);

  return { selectedClip, currentSpeed, canSetSpeed };
}
