import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";

export function useReverseState() {
  const activeClip = useEditorStore(selectToolbarClip);
  const isReversed = Boolean(activeClip?.reverse);
  const canReverse = Boolean(activeClip && !activeClip.locked);

  return { selectedClip: activeClip, isReversed, canReverse };
}
