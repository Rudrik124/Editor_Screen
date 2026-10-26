import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";

export function useDeleteState() {
  const activeClip = useEditorStore(selectToolbarClip);
  const canDelete = Boolean(activeClip && !activeClip.locked);

  return { selectedClip: activeClip, canDelete };
}
