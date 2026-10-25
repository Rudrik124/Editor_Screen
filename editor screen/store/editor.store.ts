import { create } from "zustand";
import { AspectRatio, ClipModel, TrackModel } from "../types/editor.types";
import { EditorCommand } from "../types/command.types";
import { executeCommandMutation } from "./command.executor";

// Phase 3: Layering, Transitions, Keyframes, Cover, Ratio, Replace enabled

export interface EditorStoreState {
  tracks: TrackModel[];
  clips: Record<string, ClipModel>;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  currentTime: number;
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
  setCurrentTime: (time: number) => void;
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
  { id: "music-primary", label: "Music", type: "music", clipIds: ["music-primary-clip"] },
  { id: "text", label: "Text", type: "text", clipIds: [] },
  { id: "overlay-clip", label: "Overlay Clip", type: "video", clipIds: [] },
  { id: "video", label: "Video", type: "video", clipIds: [] },
  { id: "audio", label: "Audio", type: "audio", clipIds: ["audio-clip"] },
];

const defaultClips: Record<string, ClipModel> = {
  "music-primary-clip": {
    id: "music-primary-clip",
    trackId: "music-primary",
    name: "Music  9.66",
    type: "music",
    start: 0,
    duration: 9.66,
    color: "#252b30",
  },
  "audio-clip": {
    id: "audio-clip",
    trackId: "audio",
    name: "",
    type: "audio",
    start: 0,
    duration: 9.66,
    color: "#38351b",
  },
};

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  tracks: defaultTracks,
  clips: defaultClips,
  selectedClipId: null,
  selectedTrackId: null,
  currentTime: 0,
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

    set({
      ...result.newState,
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

    set({
      ...result.newState,
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

    set({
      ...result.newState,
      history: [...state.history, commandWithInverse],
      future: newFuture,
    });

    return true;
  },

  selectClip: (clipId) => set({ selectedClipId: clipId }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setTracksAndClips: (tracks, clips) => set({ tracks, clips }),
}));
