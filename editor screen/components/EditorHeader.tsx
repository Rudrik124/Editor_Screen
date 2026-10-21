import { useState } from "react";
import { EditorIcon } from "./EditorToolIcons";
import { ExportModal } from "./ExportModal";
import "../styles/export-modal.css";

export function EditorHeader() {
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <>
      <header className="editor-header">
        <div className="brand-mark"><span>V</span> Veytrix</div>
        <div className="project-name">
          Untitled project <span className="muted">• 1080p</span>
        </div>
        <div className="header-save-indicator">
          <span>●</span> Cloud Saved
        </div>
        <div className="header-actions">
          <button
            className="header-export-btn"
            onClick={() => setIsExportOpen(true)}
            id="header-export-trigger"
          >
            Export Video
          </button>
          <button className="header-button">Upgrade</button>
          <button className="header-button icon-button" aria-label="Settings">
            <EditorIcon name="settings" />
          </button>
          <div className="avatar">RJ</div>
        </div>
      </header>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </>
  );
}

