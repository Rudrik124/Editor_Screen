import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";

export function useSplitState() {
  const activeClip = useEditorStore(selectToolbarClip);
  const currentTime = useEditorStore((state) => state.currentTime);

  const canSplit = Boolean(
    activeClip &&
      !activeClip.locked &&
      currentTime > activeClip.start + 0.05 &&
      currentTime < activeClip.start + activeClip.duration - 0.05
  );

  return { selectedClip: activeClip, currentTime, canSplit };
}
