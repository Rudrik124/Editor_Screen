import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";

export function useDuplicateState() {
  const activeClip = useEditorStore(selectActiveClipAtCurrentTime);
  const canDuplicate = Boolean(activeClip);

  return { selectedClip: activeClip, canDuplicate };
}

