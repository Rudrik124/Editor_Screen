import { useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  Keyboard,
  Export,
  CloudCheck,
} from "@phosphor-icons/react";
import { ExportModal } from "./ExportModal";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { useEditorStore } from "../store/editor.store";
import "../styles/export-modal.css";

export function EditorHeader() {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [projectName, setProjectName] = useState("Veytrix Cut");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const aspectRatio = useEditorStore((state) => state.aspectRatio);
  const history = useEditorStore((state) => state.history);
  const future = useEditorStore((state) => state.future);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  return (
    <>
      <header className="editor-header">
        <div className="brand-mark">
          <span className="brand-logo-badge">V</span>
          <span className="brand-text">Veytrix</span>
        </div>

        <div className="header-project-group">
          {isEditingTitle ? (
            <input
              type="text"
              className="project-name-input"
              value={projectName}
              autoFocus
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingTitle(false);
              }}
              onChange={(e) => setProjectName(e.target.value)}
            />
          ) : (
            <div
              className="project-name"
              title="Click to rename project"
              onClick={() => setIsEditingTitle(true)}
            >
              <span className="project-title-text">{projectName}</span>
              <span className="project-badge">1080p</span>
              <span className="project-badge">{aspectRatio}</span>
            </div>
          )}

          <div className="header-save-indicator" title="All edits autosaved locally and synced to cloud">
            <CloudCheck size={14} className="saved-icon" />
            <span className="save-text">Saved</span>
          </div>
        </div>

        {/* Quick Top Undo/Redo */}
        <div className="header-undo-redo">
          <button
            type="button"
            className="header-icon-btn"
            title="Undo (Ctrl+Z)"
            disabled={history.length === 0}
            onClick={undo}
            aria-label="Undo"
          >
            <ArrowCounterClockwise size={15} />
          </button>
          <button
            type="button"
            className="header-icon-btn"
            title="Redo (Ctrl+Shift+Z)"
            disabled={future.length === 0}
            onClick={redo}
            aria-label="Redo"
          >
            <ArrowClockwise size={15} />
          </button>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="header-shortcuts-btn"
            title="Keyboard Shortcuts"
            onClick={() => setIsShortcutsOpen(true)}
          >
            <Keyboard size={15} />
            <span>Shortcuts</span>
          </button>

          <button
            className="header-export-btn"
            onClick={() => setIsExportOpen(true)}
            id="header-export-trigger"
          >
            <Export size={15} weight="bold" />
            <span className="export-btn-label">Export Video</span>
          </button>

          <div className="avatar" title="Account: RJ">RJ</div>
        </div>
      </header>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );
}
