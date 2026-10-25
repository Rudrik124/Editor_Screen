import { Copy } from "@phosphor-icons/react";
import { useDuplicateState } from "./duplicate.state";
import { DuplicateProcessor } from "./duplicate.processor";

export function DuplicateToolbarButton() {
  const { canDuplicate } = useDuplicateState();

  return (
    <button
      type="button"
      className="icon-button"
      title="Duplicate Clip (Hotkey: Ctrl+D)"
      aria-label="Duplicate"
      disabled={!canDuplicate}
      onClick={() => DuplicateProcessor.duplicateSelectedClip()}
      style={{
        opacity: canDuplicate ? 1 : 0.4,
        cursor: canDuplicate ? "pointer" : "not-allowed",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Copy size={14} weight="regular" />
    </button>
  );
}
