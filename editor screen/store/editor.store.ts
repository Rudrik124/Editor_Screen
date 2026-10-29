import { create } from "zustand";
import { AspectRatio, ClipModel, TrackModel } from "../types/editor.types";
import { EditorCommand } from "../types/command.types";
import { executeCommandMutation } from "./command.executor";
import { DEFAULT_SAMPLE_MEDIA } from "../data/sampleMedia";

// Phase 3: Layering, Transitions, Keyframes, Cover, Ratio, Replace enabled

export interface EditorStoreState {
  tracks: TrackModel[];
  clips: Record<string, ClipModel>;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  currentTime: number;
  seekRevision: number;
  duration: number;
  isPlaying: boolean;
  aspectRatio: AspectRatio;
  coverUrl: string | null;
  history: EditorCommand[];
  future: EditorCommand[];
  historyLimit: number;

  // Actions
  dispatch: (command: EditorCommand) => boolean;
  undo: () => boolean;
  redo: () => boolean;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  setCurrentTime: (time: number, isSeek?: boolean) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  setCoverUrl: (coverUrl: string | null) => void;
  setTracksAndClips: (
    tracks: TrackModel[],
    clips: Record<string, ClipModel>
  ) => void;
}

const defaultTracks: TrackModel[] = [
  { id: "text", label: "Text", type: "text", clipIds: ["text-sample-clip"] },
  { id: "overlay-clip", label: "Overlay", type: "video", clipIds: [] },
  { id: "video", label: "Video", type: "video", clipIds: ["video-sample-clip"] },
  { id: "audio", label: "Audio Track", type: "audio", clipIds: ["audio-sample-clip"], muted: false },
];

const defaultClips: Record<string, ClipModel> = {
  "text-sample-clip": {
    id: "text-sample-clip",
    trackId: "text",
    name: "Summer Adventure",
    type: "text",
    start: 0.5,
    duration: 4.0,
    color: "#0f766e",
  },
  "video-sample-clip": {
    id: "video-sample-clip",
    trackId: "video",
    name: "Flower Sample",
    type: "video",
    start: 0,
    duration: 9.66,
    color: "#1e293b",
    mediaUrl: DEFAULT_SAMPLE_MEDIA.url,
    renderMediaUrl: DEFAULT_SAMPLE_MEDIA.url,
  },
  "audio-sample-clip": {
    id: "audio-sample-clip",
    trackId: "audio",
    name: "Cinematic Horizon",
    type: "audio",
    start: 0,
    duration: 9.66,
    color: "#1e3a8a",
    volume: 1,
    muted: false,
  },
};

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  tracks: defaultTracks,
  clips: defaultClips,
  selectedClipId: null,
  selectedTrackId: null,
  currentTime: 0,
  seekRevision: 0,
  duration: 9.66,
  isPlaying: false,
  aspectRatio: "16:9",
  coverUrl: null,
  history: [],
  future: [],
  historyLimit: 50,

  setAspectRatio: (aspectRatio: AspectRatio) => set({ aspectRatio }),
  setCoverUrl: (coverUrl: string | null) => set({ coverUrl }),

  dispatch: (command: EditorCommand): boolean => {
    const state = get();
    const result = executeCommandMutation(
      {
        tracks: state.tracks,
        clips: state.clips,
        selectedClipId: state.selectedClipId,
        duration: state.duration,
      },
      command
    );

    if (!result) return false;

    const commandWithInverse: EditorCommand = {
      ...command,
      inverse: result.inverse || command.inverse,
    };

    const newHistory = [...state.history, commandWithInverse];
    if (newHistory.length > state.historyLimit) {
      newHistory.shift();
    }

    const finalClips = result.newState.clips ?? state.clips;
    const clipEnds = Object.values(finalClips).map((c) => c.start + c.duration);
    const newDuration = Math.max(result.newState.duration ?? 0, ...clipEnds, 0);

    set({
      ...result.newState,
      duration: newDuration,
      history: newHistory,
      future: [], // New command clears redo stack
    });

    return true;
  },

  undo: (): boolean => {
    const state = get();
    if (state.history.length === 0) return false;

    const newHistory = [...state.history];
    const lastCommand = newHistory.pop()!;

    if (!lastCommand.inverse) {
      console.warn(`No inverse command available for ${lastCommand.type}`);
      return false;
    }

    const result = executeCommandMutation(
      {
        tracks: state.tracks,
        clips: state.clips,
        selectedClipId: state.selectedClipId,
        duration: state.duration,
      },
      lastCommand.inverse
    );

    if (!result) return false;

    const finalClips = result.newState.clips ?? state.clips;
    const clipEnds = Object.values(finalClips).map((c) => c.start + c.duration);
    const newDuration = Math.max(result.newState.duration ?? 0, ...clipEnds, 0);

    set({
      ...result.newState,
      duration: newDuration,
      history: newHistory,
      future: [lastCommand, ...state.future],
    });

    return true;
  },

  redo: (): boolean => {
    const state = get();
    if (state.future.length === 0) return false;

    const newFuture = [...state.future];
    const nextCommand = newFuture.shift()!;

    const result = executeCommandMutation(
      {
        tracks: state.tracks,
        clips: state.clips,
        selectedClipId: state.selectedClipId,
        duration: state.duration,
      },
      nextCommand
    );

    if (!result) return false;

    const commandWithInverse: EditorCommand = {
      ...nextCommand,
      inverse: result.inverse || nextCommand.inverse,
    };

    const finalClips = result.newState.clips ?? state.clips;
    const clipEnds = Object.values(finalClips).map((c) => c.start + c.duration);
    const newDuration = Math.max(result.newState.duration ?? 0, ...clipEnds, 0);

    set({
      ...result.newState,
      duration: newDuration,
      history: [...state.history, commandWithInverse],
      future: newFuture,
    });

    return true;
  },

  selectClip: (clipId) => set({ selectedClipId: clipId }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  setCurrentTime: (currentTime, isSeek = true) =>
    set((state) => ({
      currentTime,
      seekRevision: state.seekRevision + (isSeek ? 1 : 0),
    })),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setTracksAndClips: (tracks, clips) => set({ tracks, clips }),
}));
