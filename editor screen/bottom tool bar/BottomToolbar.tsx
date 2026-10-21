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
      <span className="veytrix-bottom-toolbar__group">
        <SplitToolbarButton />
        <TrimToolbarButton />
      </span>

      <span className="veytrix-bottom-toolbar__separator" aria-hidden="true" />

      <span className="veytrix-bottom-toolbar__group">
        <SpeedToolbarButton />
        <ReverseToolbarButton />
        <FreezeToolbarButton />
      </span>

      <span className="veytrix-bottom-toolbar__separator" aria-hidden="true" />

      <span className="veytrix-bottom-toolbar__group">
        <DuplicateToolbarButton />
        <RenameToolbarButton />
        <LockToolbarButton />
        <DeleteToolbarButton />
      </span>
    </nav>
  );
}
