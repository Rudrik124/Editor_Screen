import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";

export function useTrimState() {
  const activeClip = useEditorStore(selectActiveClipAtCurrentTime);
  const canTrim = Boolean(activeClip && !activeClip.locked);

  return { selectedClip: activeClip, canTrim };
}
