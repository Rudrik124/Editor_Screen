import { EditorCommand } from "../types/command.types";
import { CaptionItem, ClipModel, TrackModel } from "../types/editor.types";
import { TimelineStateSlice } from "./clip.mutations";

export function handleAddCaption(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, captions } = command.payload as {
    clipId: string;
    captions: CaptionItem[];
  };

  if (!captions || !Array.isArray(captions) || captions.length === 0) {
    return null;
  }

  // Find or create the text/caption track
  let updatedTracks = [...state.tracks];
  let textTrackIndex = updatedTracks.findIndex((t) => t.id === "text" || t.type === "text");
  let textTrack: TrackModel;

  if (textTrackIndex === -1) {
    textTrack = { id: "text", label: "Captions", type: "text", clipIds: [] };
    updatedTracks = [textTrack, ...updatedTracks];
    textTrackIndex = 0;
  } else {
    textTrack = { ...updatedTracks[textTrackIndex], clipIds: [...updatedTracks[textTrackIndex].clipIds] };
    updatedTracks[textTrackIndex] = textTrack;
  }

  const updatedClips = { ...state.clips };
  const createdClipIds: string[] = [];

  captions.forEach((cap, idx) => {
    const capClipId = cap.id || `cap-${clipId}-${idx + 1}-${Date.now()}`;
    createdClipIds.push(capClipId);
    const dur = Math.max(0.1, cap.endTime - cap.startTime);

    const captionClip: ClipModel = {
      id: capClipId,
      trackId: textTrack.id,
      name: cap.text,
      content: cap.text,
      text_data: {
        text: cap.text,
        fontSize: 28,
        color: "#ffffff",
        x: 50,
        y: 85,
        alignment: "center",
      },
      type: "text",
      start: cap.startTime,
      duration: dur,
      start_time: cap.startTime,
      end_time: cap.endTime,
      inPoint: 0,
      outPoint: dur,
      color: "#0891b2",
    };

    updatedClips[capClipId] = captionClip;
    if (!textTrack.clipIds.includes(capClipId)) {
      textTrack.clipIds.push(capClipId);
    }
  });

  // Attach captions metadata to source clip if it exists
  const sourceClip = state.clips[clipId];
  const previousCaptions = sourceClip?.captions || [];
  if (sourceClip) {
    updatedClips[clipId] = {
      ...sourceClip,
      captions,
    };
  }

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "REMOVE_CAPTION",
    payload: {
      clipId,
      captionClipIds: createdClipIds,
      previousCaptions,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      tracks: updatedTracks,
      clips: updatedClips,
    },
    inverse,
  };
}

export function handleUpdateCaption(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, captionId, updates } = command.payload as {
    clipId: string;
    captionId: string;
    updates: Partial<CaptionItem>;
  };

  const targetClip = state.clips[captionId];
  const sourceClip = state.clips[clipId];
  if (!targetClip && !sourceClip) return null;

  const updatedClips = { ...state.clips };

  let previousItem: CaptionItem | undefined;
  if (sourceClip && sourceClip.captions) {
    const prevCap = sourceClip.captions.find((c) => c.id === captionId);
    if (prevCap) {
      previousItem = { ...prevCap };
      updatedClips[clipId] = {
        ...sourceClip,
        captions: sourceClip.captions.map((c) => (c.id === captionId ? { ...c, ...updates } : c)),
      };
    }
  }

  if (targetClip) {
    const newText = updates.text ?? targetClip.content ?? targetClip.name;
    const newStart = updates.startTime ?? targetClip.start;
    const newEnd = updates.endTime ?? (targetClip.start + targetClip.duration);
    const newDur = Math.max(0.1, newEnd - newStart);

    updatedClips[captionId] = {
      ...targetClip,
      name: newText,
      content: newText,
      start: newStart,
      duration: newDur,
      start_time: newStart,
      end_time: newEnd,
      inPoint: 0,
      outPoint: newDur,
      text_data: {
        ...(targetClip.text_data || {}),
        text: newText,
      },
    };
  }

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "UPDATE_CAPTION",
    payload: {
      clipId,
      captionId,
      updates: previousItem || {},
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: updatedClips,
    },
    inverse,
  };
}

export function handleRemoveCaption(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, captionId, captionClipIds } = command.payload as {
    clipId: string;
    captionId?: string;
    captionClipIds?: string[];
  };

  const idsToRemove = captionClipIds || (captionId ? [captionId] : []);
  if (idsToRemove.length === 0) return null;

  const updatedClips = { ...state.clips };
  const removedClips: ClipModel[] = [];

  idsToRemove.forEach((id) => {
    if (updatedClips[id]) {
      removedClips.push(updatedClips[id]);
      delete updatedClips[id];
    }
  });

  const updatedTracks = state.tracks.map((t) => {
    if (t.id === "text" || t.type === "text") {
      return {
        ...t,
        clipIds: t.clipIds.filter((id) => !idsToRemove.includes(id)),
      };
    }
    return t;
  });

  const sourceClip = state.clips[clipId];
  if (sourceClip && sourceClip.captions) {
    updatedClips[clipId] = {
      ...sourceClip,
      captions: sourceClip.captions.filter((c) => !idsToRemove.includes(c.id)),
    };
  }

  return {
    newState: {
      tracks: updatedTracks,
      clips: updatedClips,
    },
  };
}

