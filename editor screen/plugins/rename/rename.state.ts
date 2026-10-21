import { useEditorStore } from "../../store/editor.store";
import { selectSelectedClip } from "../../store/store.selectors";

export function useRenameState() {
  const selectedClip = useEditorStore(selectSelectedClip);
  const canRename = Boolean(selectedClip && !selectedClip.locked);

  return { selectedClip, canRename };
}
