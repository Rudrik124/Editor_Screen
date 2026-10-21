import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";

export function useDeleteState() {
  const activeClip = useEditorStore(selectActiveClipAtCurrentTime);
  const canDelete = Boolean(activeClip && !activeClip.locked);

  return { selectedClip: activeClip, canDelete };
}
