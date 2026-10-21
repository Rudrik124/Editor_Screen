import { useEditorStore } from "../../store/editor.store";

export const UndoRedoProcessor = {
  undo: (): boolean => {
    return useEditorStore.getState().undo();
  },
  redo: (): boolean => {
    return useEditorStore.getState().redo();
  },
};
