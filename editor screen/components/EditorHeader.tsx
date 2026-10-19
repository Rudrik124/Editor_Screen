import { EditorIcon } from "./EditorToolIcons";

export function EditorHeader() {
  return (
    <header className="editor-header">
      <div className="brand-mark"><span>V</span> Veytrix</div>
      <div className="project-name">Untitled project <span className="muted">• 1080p</span></div>
      <div className="header-actions">
        <button className="header-button">Upgrade</button>
        <button className="header-button icon-button" aria-label="Settings"><EditorIcon name="settings" /></button>
        <div className="avatar">RJ</div>
      </div>
    </header>
  );
}
