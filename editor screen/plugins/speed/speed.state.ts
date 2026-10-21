import { useEditorStore } from "../../store/editor.store";
import { selectSpeedClip } from "../../store/store.selectors";

export function useSpeedState() {
  const selectedClip = useEditorStore(selectSpeedClip);
  const currentSpeed = selectedClip?.speed ?? 1.0;
  const canSetSpeed = Boolean(selectedClip && !selectedClip.locked);

  return { selectedClip, currentSpeed, canSetSpeed };
}
