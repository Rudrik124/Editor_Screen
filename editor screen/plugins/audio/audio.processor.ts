import { useEditorStore } from "../../store/editor.store";
import { createAudioCommand } from "./audio.command";

export const AudioProcessor = {
  setVolume: (clipId: string, volume: number): boolean =>
    useEditorStore.getState().dispatch(
      createAudioCommand("SET_AUDIO_VOLUME", { clipId, volume })
    ),

  setClipMuted: (clipId: string, muted: boolean): boolean =>
    useEditorStore.getState().dispatch(
      createAudioCommand("MUTE_CLIP", { clipId, muted })
    ),

  setTrackMuted: (trackId: string, muted: boolean): boolean =>
    useEditorStore.getState().dispatch(
      createAudioCommand("MUTE_TRACK", { trackId, muted })
    ),

  extractAudio: (clipId: string): boolean => {
    const newClipId = `audio-${clipId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return useEditorStore.getState().dispatch(
      createAudioCommand("EXTRACT_AUDIO", { clipId, newClipId })
    );
  },
};
