import { useUndoRedoState } from "./undo-redo.state";
import { UndoRedoProcessor } from "./undo-redo.processor";

export function UndoRedoToolbarButtons() {
  const { canUndo, canRedo } = useUndoRedoState();

  return (
    <div className="undo-redo-buttons" style={{ display: "inline-flex", gap: "4px" }}>
      <button
        type="button"
        className="icon-button"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={() => UndoRedoProcessor.undo()}
        style={{
          opacity: canUndo ? 1 : 0.4,
          cursor: canUndo ? "pointer" : "not-allowed",
          padding: "4px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>
      <button
        type="button"
        className="icon-button"
        title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={() => UndoRedoProcessor.redo()}
        style={{
          opacity: canRedo ? 1 : 0.4,
          cursor: canRedo ? "pointer" : "not-allowed",
          padding: "4px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      </button>
    </div>
  );
}
