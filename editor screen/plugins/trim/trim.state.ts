import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";

export function useTrimState() {
  const activeClip = useEditorStore(selectToolbarClip);
  const canTrim = Boolean(activeClip && !activeClip.locked);

  return { selectedClip: activeClip, canTrim };
}
