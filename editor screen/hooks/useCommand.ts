import { useEditorStore } from "../store/editor.store";
import { EditorCommand, CommandType } from "../types/command.types";
import { useCallback } from "react";

export function useCommand() {
  const dispatch = useEditorStore((state) => state.dispatch);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.history.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);

  const execute = useCallback(
    (type: CommandType, payload: Record<string, unknown>) => {
      const command: EditorCommand = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type,
        payload,
        timestamp: Date.now(),
      };
      return dispatch(command);
    },
    [dispatch]
  );

  return {
    dispatch,
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
