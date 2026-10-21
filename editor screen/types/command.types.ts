export type CommandType =
  | "SPLIT_CLIP"
  | "MERGE_CLIPS"
  | "DUPLICATE_CLIP"
  | "DELETE_CLIP"
  | "ADD_CLIP"
  | "RENAME_CLIP"
  | "LOCK_CLIP"
  | "UNLOCK_CLIP"
  | "TRIM_CLIP"
  | "SET_SPEED"
  | "REVERSE_CLIP"
  | "FREEZE_CLIP"
  | "RESTORE_FREEZE_CLIPS"
  | "CLOSE_GAP"
  | "MOVE_CLIP"
  | "BATCH_COMMAND";

export interface EditorCommand {
  id: string;
  type: CommandType;
  payload: Record<string, unknown>;
  inverse?: EditorCommand;
  timestamp: number;
}

export interface CommandResult {
  success: boolean;
  error?: string;
}
