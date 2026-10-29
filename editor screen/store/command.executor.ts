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
import {
  handleAddTransition,
  handleRemoveTransition,
  handleSetOverlap,
  handleSetClipTransform,
  handleAddKeyframe,
  handleRemoveKeyframe,
  handleSetRatio,
  handleSetCover,
  handleReplaceClip,
} from "./phase3.mutations";
import { sanitizeClipName } from "./sanitize";
import {
  handleExtractAudio,
  handleRestoreExtractAudio,
  handleSetAudioVolume,
  handleMuteClip,
  handleMuteTrack,
} from "./audio.mutations";

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
    case "ADD_TRANSITION":
      return handleAddTransition(state, command);
    case "REMOVE_TRANSITION":
      return handleRemoveTransition(state, command);
    case "SET_OVERLAP":
      return handleSetOverlap(state, command);
    case "SET_CLIP_TRANSFORM":
      return handleSetClipTransform(state, command);
    case "ADD_KEYFRAME":
      return handleAddKeyframe(state, command);
    case "REMOVE_KEYFRAME":
      return handleRemoveKeyframe(state, command);
    case "SET_RATIO":
      return handleSetRatio(state, command);
    case "SET_COVER":
      return handleSetCover(state, command);
    case "REPLACE_CLIP":
      return handleReplaceClip(state, command);
    case "EXTRACT_AUDIO":
      return handleExtractAudio(state, command);
    case "RESTORE_EXTRACT_AUDIO":
      return handleRestoreExtractAudio(state, command);
    case "SET_AUDIO_VOLUME":
      return handleSetAudioVolume(state, command);
    case "MUTE_CLIP":
      return handleMuteClip(state, command);
    case "MUTE_TRACK":
      return handleMuteTrack(state, command);
    default:
      console.warn(`Unknown command type: ${type}`);
      return null;
  }
}
