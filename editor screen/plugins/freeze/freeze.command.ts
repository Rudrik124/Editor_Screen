import { EditorCommand } from "../../types/command.types";

export interface FreezeClipPayload {
  clipId: string;
  freezeAt: number;
  freezeDuration?: number;
  freezeClipId?: string;
  rightClipId?: string;
}

export function createFreezeCommand(
  clipId: string,
  freezeAt: number,
  freezeDuration = 2.0
): EditorCommand {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  return {
    id: `frz-${ts}-${rand}`,
    type: "FREEZE_CLIP",
    payload: {
      clipId,
      freezeAt,
      freezeDuration,
      freezeClipId: `frz-clip-${ts}-${rand}`,
      rightClipId: `part2-${ts}-${rand}`,
    },
    timestamp: ts,
  };
}
