import { EditorCommand } from "../types/command.types";
import {
  TimelineStateSlice,
  handleSplitClip,
  handleMergeClips,
  handleDuplicateClip,
  handleDeleteClip,
  handleAddClip,
} from "./clip.mutations";
import {
  handleRenameClip,
  handleLockClip,
  handleUnlockClip,
} from "./property.mutations";
import {
  handleTrimClip,
  handleSetSpeed,
  handleReverseClip,
  handleFreezeClip,
  handleRestoreFreezeClips,
} from "./phase2.mutations";
import { handleCloseGap, handleMoveClip } from "./gap.mutations";
import { sanitizeClipName } from "./sanitize";

export { sanitizeClipName };
export type { TimelineStateSlice };

export function executeCommandMutation(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { type } = command;

  switch (type) {
    case "SPLIT_CLIP":
      return handleSplitClip(state, command);
    case "MERGE_CLIPS":
      return handleMergeClips(state, command);
    case "DUPLICATE_CLIP":
      return handleDuplicateClip(state, command);
    case "DELETE_CLIP":
      return handleDeleteClip(state, command);
    case "ADD_CLIP":
      return handleAddClip(state, command);
    case "RENAME_CLIP":
      return handleRenameClip(state, command);
    case "LOCK_CLIP":
      return handleLockClip(state, command);
    case "UNLOCK_CLIP":
      return handleUnlockClip(state, command);
    case "TRIM_CLIP":
      return handleTrimClip(state, command);
    case "SET_SPEED":
      return handleSetSpeed(state, command);
    case "REVERSE_CLIP":
      return handleReverseClip(state, command);
    case "FREEZE_CLIP":
      return handleFreezeClip(state, command);
    case "RESTORE_FREEZE_CLIPS":
      return handleRestoreFreezeClips(state, command);
    case "CLOSE_GAP":
      return handleCloseGap(state, command);
    case "MOVE_CLIP":
      return handleMoveClip(state, command);
    default:
      console.warn(`Unknown command type: ${type}`);
      return null;
  }
}
