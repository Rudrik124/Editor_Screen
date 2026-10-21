import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";

export function useFreezeState() {
  const activeClip = useEditorStore(selectActiveClipAtCurrentTime);
  const currentTime = useEditorStore((state) => state.currentTime);

  const canFreeze = Boolean(
    activeClip &&
      !activeClip.locked &&
      currentTime > activeClip.start + 0.05 &&
      currentTime < activeClip.start + activeClip.duration - 0.05
  );

  return { selectedClip: activeClip, currentTime, canFreeze };
}

