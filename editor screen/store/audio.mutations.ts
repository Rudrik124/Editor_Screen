import { ClipModel } from "../types/editor.types";
import { EditorCommand } from "../types/command.types";
import { TimelineStateSlice } from "./clip.mutations";

type AudioClip = ClipModel & {
  mediaType?: "video" | "image" | "audio";
};

function commandId(prefix: string, command: EditorCommand): string {
  return `${prefix}-${command.id}`;
}

function getAudioTrack(state: TimelineStateSlice) {
  return state.tracks.find((track) => track.type === "audio" || track.type === "music");
}

function isAudioCapable(clip: ClipModel): boolean {
  return clip.type === "video" || clip.type === "audio" || clip.type === "music";
}

export function handleSetAudioVolume(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, volume } = command.payload as { clipId: string; volume: number };
  const clip = state.clips[clipId];
  if (!clip || !isAudioCapable(clip) || clip.locked || !Number.isFinite(volume)) {
    return null;
  }

  const track = state.tracks.find((candidate) => candidate.id === clip.trackId);
  if (!track || track.locked) return null;

  const nextVolume = Math.max(0, Math.min(2, volume));
  const previousVolume = clip.volume ?? 1;
  if (nextVolume === previousVolume) return null;

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: { ...clip, volume: nextVolume },
      },
    },
    inverse: {
      id: commandId("inv-volume", command),
      type: "SET_AUDIO_VOLUME",
      payload: { clipId, volume: previousVolume },
      timestamp: Date.now(),
    },
  };
}

export function handleMuteClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, muted } = command.payload as { clipId: string; muted: boolean };
  const clip = state.clips[clipId];
  if (!clip || !isAudioCapable(clip) || clip.locked || typeof muted !== "boolean") {
    return null;
  }

  const track = state.tracks.find((candidate) => candidate.id === clip.trackId);
  if (!track || track.locked || (clip.muted ?? false) === muted) return null;

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: { ...clip, muted },
      },
    },
    inverse: {
      id: commandId("inv-mute-clip", command),
      type: "MUTE_CLIP",
      payload: { clipId, muted: !muted },
      timestamp: Date.now(),
    },
  };
}

export function handleMuteTrack(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { trackId, muted } = command.payload as { trackId: string; muted: boolean };
  const track = state.tracks.find((candidate) => candidate.id === trackId);
  if (!track || track.locked || typeof muted !== "boolean" || (track.muted ?? false) === muted) {
    return null;
  }

  return {
    newState: {
      tracks: state.tracks.map((candidate) =>
        candidate.id === trackId ? { ...candidate, muted } : candidate
      ),
    },
    inverse: {
      id: commandId("inv-mute-track", command),
      type: "MUTE_TRACK",
      payload: { trackId, muted: !muted },
      timestamp: Date.now(),
    },
  };
}

export function handleExtractAudio(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const payload = (command.payload || {}) as {
    clipId?: string;
    sourceClipId?: string;
    newClipId?: string;
  };

  // Gracefully resolve target video clip if omitted or invalid
  let targetClipId = payload.clipId || payload.sourceClipId || state.selectedClipId;
  if (!targetClipId || !state.clips[targetClipId] || state.clips[targetClipId].type !== "video") {
    const firstVideo = Object.values(state.clips).find((c) => c.type === "video");
    if (firstVideo) {
      targetClipId = firstVideo.id;
    }
  }

  if (!targetClipId) return null;
  const sourceClip = state.clips[targetClipId];
  const audioTrack = getAudioTrack(state);

  if (!sourceClip || sourceClip.type !== "video" || sourceClip.locked) return null;
  if (!audioTrack || audioTrack.locked) return null;

  const newClipId =
    payload.newClipId ||
    `audio-${targetClipId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  if (state.clips[newClipId]) return null;

  const extractedClip: AudioClip = {
    ...sourceClip,
    id: newClipId,
    trackId: audioTrack.id,
    type: "audio",
    mediaType: "audio",
    name: `${sourceClip.name} (Audio)`,
    volume: 1,
    muted: false,
    locked: false,
    // BUG FIX (Phase 4): server-readable path for FFmpeg audio extraction.
    // sourceClip.mediaUrl may be a blob:// URL the backend cannot access.
    renderMediaUrl: sourceClip.renderMediaUrl ?? sourceClip.mediaUrl,
  };

  const insertIndex = audioTrack.clipIds.length;
  const updatedTracks = state.tracks.map((track) => {
    if (track.id === audioTrack.id) {
      return { ...track, clipIds: [...track.clipIds, newClipId] };
    }
    return track;
  });

  return {
    newState: {
      clips: {
        ...state.clips,
        [targetClipId]: { ...sourceClip, muted: true },
        [newClipId]: extractedClip,
      },
      tracks: updatedTracks,
      selectedClipId: newClipId,
    },
    inverse: {
      id: commandId("inv-extract-audio", command),
      type: "RESTORE_EXTRACT_AUDIO",
      payload: {
        sourceClipId: targetClipId,
        audioClip: extractedClip,
        audioTrackId: audioTrack.id,
        insertIndex,
        sourceMuted: sourceClip.muted ?? false,
      },
      timestamp: Date.now(),
    },
  };
}

export function handleRestoreExtractAudio(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const {
    sourceClipId,
    audioClip,
    audioTrackId,
    sourceMuted,
  } = command.payload as {
    sourceClipId: string;
    audioClip: ClipModel;
    audioTrackId: string;
    insertIndex?: number;
    sourceMuted: boolean;
  };
  const sourceClip = state.clips[sourceClipId];
  const audioTrack = state.tracks.find((track) => track.id === audioTrackId);
  if (!sourceClip || !audioTrack || !state.clips[audioClip.id]) return null;

  const clipIds = audioTrack.clipIds.filter((id) => id !== audioClip.id);
  const restoredClips = { ...state.clips };
  delete restoredClips[audioClip.id];
  restoredClips[sourceClipId] = { ...sourceClip, muted: sourceMuted };

  return {
    newState: {
      clips: restoredClips,
      tracks: state.tracks.map((track) =>
        track.id === audioTrackId ? { ...track, clipIds } : track
      ),
      selectedClipId: sourceClipId,
    },
    inverse: {
      id: commandId("redo-extract-audio", command),
      type: "EXTRACT_AUDIO",
      payload: {
        clipId: sourceClipId,
        newClipId: audioClip.id,
      },
      timestamp: Date.now(),
    },
  };
}
