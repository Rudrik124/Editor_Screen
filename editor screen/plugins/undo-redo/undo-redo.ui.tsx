import { ArrowCounterClockwise, ArrowClockwise } from "@phosphor-icons/react";
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
        <ArrowCounterClockwise size={14} weight="bold" />
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
        <ArrowClockwise size={14} weight="bold" />
      </button>
    </div>
  );
}
