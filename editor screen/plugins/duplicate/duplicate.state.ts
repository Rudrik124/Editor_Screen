import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";

export function useDuplicateState() {
  const activeClip = useEditorStore(selectToolbarClip);
  const canDuplicate = Boolean(activeClip);

  return { selectedClip: activeClip, canDuplicate };
}
