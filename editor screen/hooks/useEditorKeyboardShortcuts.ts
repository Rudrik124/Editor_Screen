import { useEffect } from "react";
import { useEditorStore } from "../store/editor.store";
import { SplitProcessor } from "../plugins/split";
import { DeleteProcessor } from "../plugins/delete";

export function useEditorKeyboardShortcuts() {
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      // Undo: Ctrl+Z or Cmd+Z (without shift)
      if (modKey && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Shift+Z, Cmd+Shift+Z, or Ctrl+Y
      if (
        (modKey && event.shiftKey && event.key.toLowerCase() === "z") ||
        (modKey && event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        redo();
        return;
      }

      // Delete: Delete or Backspace
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        DeleteProcessor.deleteSelectedClip();
        return;
      }

      // Split: S key
      if (!modKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        SplitProcessor.splitAtCurrentTime();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [undo, redo]);
}
