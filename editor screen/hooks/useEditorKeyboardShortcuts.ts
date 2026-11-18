import { useEffect } from "react";
import { useEditorStore } from "../store/editor.store";
import { SplitProcessor } from "../plugins/split";
import { DeleteProcessor } from "../plugins/delete";

const spaceKeyControls =
  "select, summary, audio[controls], video[controls], " +
  "[role='checkbox'], [role='radio'], [role='switch'], " +
  "[role='combobox'], [role='listbox'], [role='option'], [role='menuitem'], " +
  "[role='menuitemcheckbox'], [role='menuitemradio'], [role='slider'], [role='tab']";

export function useEditorKeyboardShortcuts(togglePlayback: () => void) {
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput = target instanceof HTMLInputElement;
      const isEditable = target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (event.key === " ") {
        if (
          event.defaultPrevented ||
          isEditable ||
          (isInput && target.type !== "file") ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
        ) {
          return;
        }
        const control = target instanceof Element ? target.closest(spaceKeyControls) : null;
        if (control) return;

        event.preventDefault();
        if (!event.repeat) togglePlayback();
        return;
      }

      if (isInput || isEditable) return;

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
  }, [undo, redo, togglePlayback]);
}
