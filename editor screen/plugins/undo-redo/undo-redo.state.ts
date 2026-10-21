import { useEditorStore } from "../../store/editor.store";

export function useUndoRedoState() {
  const canUndo = useEditorStore((state) => state.history.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const historyCount = useEditorStore((state) => state.history.length);
  const futureCount = useEditorStore((state) => state.future.length);

  return { canUndo, canRedo, historyCount, futureCount };
}
