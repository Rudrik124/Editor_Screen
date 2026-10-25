import { Trash } from "@phosphor-icons/react";
import { useDeleteState } from "./delete.state";
import { DeleteProcessor } from "./delete.processor";

export function DeleteToolbarButton() {
  const { canDelete } = useDeleteState();

  return (
    <button
      type="button"
      className="icon-button"
      title="Delete Clip (Hotkey: Del / Backspace)"
      aria-label="Delete"
      disabled={!canDelete}
      onClick={() => DeleteProcessor.deleteSelectedClip()}
      style={{
        opacity: canDelete ? 1 : 0.4,
        cursor: canDelete ? "pointer" : "not-allowed",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Trash size={14} weight="regular" />
    </button>
  );
}
