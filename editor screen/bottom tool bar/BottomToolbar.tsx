import "./bottom-toolbar.css";
import { SplitToolbarButton } from "../plugins/split";
import { TrimToolbarButton } from "../plugins/trim";
import { SpeedToolbarButton } from "../plugins/speed";
import { ReverseToolbarButton } from "../plugins/reverse";
import { FreezeToolbarButton } from "../plugins/freeze";
import { DuplicateToolbarButton } from "../plugins/duplicate";
import { RenameToolbarButton } from "../plugins/rename";
import { LockToolbarButton } from "../plugins/lock";
import { DeleteToolbarButton } from "../plugins/delete";

export function BottomToolbar() {
  return (
    <nav className="veytrix-bottom-toolbar" aria-label="Editing tools">
      {/* Group 1: Cut & Trim */}
      <div className="toolbar-cluster">
        <div className="toolbar-item" title="Split clip at playhead (Hotkey: S)">
          <SplitToolbarButton />
          <span className="toolbar-item-label">Split</span>
        </div>
        <div className="toolbar-item" title="Trim clip edges to playhead">
          <TrimToolbarButton />
          <span className="toolbar-item-label">Trim</span>
        </div>
      </div>

      <span className="veytrix-bottom-toolbar__separator" aria-hidden="true" />

      {/* Group 2: Time & Motion */}
      <div className="toolbar-cluster">
        <div className="toolbar-item" title="Playback speed (0.25x - 4x)">
          <SpeedToolbarButton />
          <span className="toolbar-item-label">Speed</span>
        </div>
        <div className="toolbar-item" title="Reverse clip playback">
          <ReverseToolbarButton />
          <span className="toolbar-item-label">Reverse</span>
        </div>
        <div className="toolbar-item" title="Freeze frame at playhead (+3s)">
          <FreezeToolbarButton />
          <span className="toolbar-item-label">Freeze</span>
        </div>
      </div>

      <span className="veytrix-bottom-toolbar__separator" aria-hidden="true" />

      {/* Group 3: Clip Management */}
      <div className="toolbar-cluster">
        <div className="toolbar-item" title="Duplicate clip (Hotkey: Ctrl+D)">
          <DuplicateToolbarButton />
          <span className="toolbar-item-label">Duplicate</span>
        </div>
        <div className="toolbar-item" title="Rename clip">
          <RenameToolbarButton />
          <span className="toolbar-item-label">Rename</span>
        </div>
        <div className="toolbar-item" title="Lock / Unlock clip on timeline">
          <LockToolbarButton />
          <span className="toolbar-item-label">Lock</span>
        </div>
        <div className="toolbar-item delete-item" title="Delete selected clip (Hotkey: Del)">
          <DeleteToolbarButton />
          <span className="toolbar-item-label">Delete</span>
        </div>
      </div>
    </nav>
  );
}
