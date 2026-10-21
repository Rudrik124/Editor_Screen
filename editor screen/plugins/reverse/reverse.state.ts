import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";

export function useReverseState() {
  const activeClip = useEditorStore(selectActiveClipAtCurrentTime);
  const isReversed = Boolean(activeClip?.reverse);
  const canReverse = Boolean(activeClip && !activeClip.locked);

  return { selectedClip: activeClip, isReversed, canReverse };
}
