import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";

export function useLockState() {
  const activeClip = useEditorStore(selectActiveClipAtCurrentTime);
  const isLocked = Boolean(activeClip?.locked);
  const canToggleLock = Boolean(activeClip);

  return { selectedClip: activeClip, isLocked, canToggleLock };
}

