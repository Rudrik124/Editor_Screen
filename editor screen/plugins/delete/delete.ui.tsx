import { useDeleteState } from "./delete.state";
import { DeleteProcessor } from "./delete.processor";

export function DeleteToolbarButton() {
  const { canDelete } = useDeleteState();

  return (
    <button
      type="button"
      className="icon-button"
      title="Delete Clip (Delete/Backspace)"
      aria-label="Delete"
      disabled={!canDelete}
      onClick={() => DeleteProcessor.deleteSelectedClip()}
      style={{
        opacity: canDelete ? 1 : 0.4,
        cursor: canDelete ? "pointer" : "not-allowed",
        padding: "4px 6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  );
}
