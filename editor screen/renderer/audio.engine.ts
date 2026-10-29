import { ClipModel, TrackModel } from "../types/editor.types";
import { EditorStoreState } from "../store/editor.store";
import { useEditorStore } from "../store/editor.store";
import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import soundTouchProcessorUrl from "@soundtouchjs/audio-worklet/processor?url";
import { getAudioPlaybackRate, getAudioSourceRange } from "../utils/audioTimeline";

const soundTouchRegistrations = new WeakMap<BaseAudioContext, Promise<void>>();

interface ScheduledSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
  stretchNode?: SoundTouchNode;
  signature: string;
  volume: number;
}

function registerSoundTouch(context: BaseAudioContext): Promise<void> {
  const existing = soundTouchRegistrations.get(context);
  if (existing) return existing;

  const registration = SoundTouchNode.register(context, soundTouchProcessorUrl).catch(
    (error: unknown) => {
      soundTouchRegistrations.delete(context);
      throw error;
    }
  );
  soundTouchRegistrations.set(context, registration);
  return registration;
}

function isAudioClip(clip: ClipModel): boolean {
  return (
    (clip.type === "video" && clip.mediaType !== "image") ||
    clip.type === "audio" ||
    clip.type === "music"
  );
}

function getTrackMuted(trackId: string, tracks: TrackModel[]): boolean {
  return tracks.find((track) => track.id === trackId)?.muted ?? false;
}

function getClipSignature(clip: ClipModel, trackMuted: boolean): string {
  return JSON.stringify([
    clip.mediaUrl,
    clip.start,
    clip.duration,
    clip.inPoint ?? 0,
    clip.speed ?? 1,
    clip.muted ?? false,
    trackMuted,
  ]);
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private decodedBuffers = new Map<string, AudioBuffer>();
  private scheduled = new Map<string, ScheduledSource>();
  private generation = 0;
  private preparing = false;
  private previousState: EditorStoreState | null = null;

  constructor(private readonly onError: (message: string | null) => void) {}

  handleStateChange(state: EditorStoreState): void {
    const previous = this.previousState;
    this.previousState = state;

    if (!state.isPlaying) {
      this.generation += 1;
      this.preparing = false;
      this.stopScheduled();
      return;
    }

    if (!previous?.isPlaying) {
      void this.prepareAndSchedule();
      return;
    }

    if (this.preparing) return;

    const wasSeek = state.seekRevision !== previous.seekRevision;
    if (wasSeek || this.hasScheduleChanged(previous, state)) {
      void this.prepareAndSchedule();
      return;
    }

    this.updateGains(state);
  }

  async destroy(): Promise<void> {
    this.generation += 1;
    this.preparing = false;
    this.stopScheduled();
    this.buffers.clear();
    this.decodedBuffers.clear();
    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }
    this.context = null;
  }

  private ensureContext(): AudioContext {
    if (!this.context || this.context.state === "closed") {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error("Web Audio is not supported by this browser.");
      }
      this.context = new AudioContextConstructor();
    }
    return this.context;
  }

  private async prepareAndSchedule(): Promise<void> {
    const generation = ++this.generation;
    this.preparing = true;
    this.stopScheduled();

    try {
      const context = this.ensureContext();
      if (context.state !== "running") await context.resume();
      if (context.state !== "running") {
        throw new Error("The browser did not allow audio playback to start.");
      }

      const initialState = useEditorStore.getState();
      const mediaClips = this.getAudibleTimelineClips(initialState);
      const loadErrors: string[] = [];
      await Promise.all(
        mediaClips.map(async ({ clip }) => {
          try {
            await this.getBuffer(clip.mediaUrl!);
          } catch (error) {
            loadErrors.push(
              error instanceof Error ? error.message : `Unable to load audio for "${clip.name}".`
            );
          }
        })
      );

      const state = useEditorStore.getState();
      if (generation !== this.generation || !state.isPlaying) return;
      const needsPitchPreservation = this.getAudibleTimelineClips(state).some(({ clip }) => {
        const buffer = clip.mediaUrl ? this.peekBuffer(clip.mediaUrl) : null;
        if (!buffer) return false;
        const sourceRange = getAudioSourceRange(clip, buffer.duration);
        return (
          sourceRange.duration > 0 &&
          Math.abs(getAudioPlaybackRate(clip, buffer.duration) - 1) > 0.001
        );
      });
      if (needsPitchPreservation) await registerSoundTouch(context);
      if (generation !== this.generation || !useEditorStore.getState().isPlaying) return;
      this.scheduleAtCurrentTime(state);
      this.onError(loadErrors.length ? loadErrors.join(" ") : null);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Unable to initialize audio playback.";
      this.onError(message);
      useEditorStore.getState().setIsPlaying(false);
    } finally {
      if (generation === this.generation) this.preparing = false;
    }
  }

  private getAudibleTimelineClips(state: EditorStoreState): Array<{ clip: ClipModel; trackMuted: boolean }> {
    return Object.values(state.clips)
      .filter((clip) => isAudioClip(clip) && Boolean(clip.mediaUrl))
      .map((clip) => ({
        clip,
        trackMuted: getTrackMuted(clip.trackId, state.tracks),
      }))
      .filter(({ clip, trackMuted }) => !clip.muted && !trackMuted);
  }

  private async getBuffer(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url);
    if (cached) return cached;

    const context = this.ensureContext();
    const bufferPromise = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Audio media request failed (${response.status}).`);
        }
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        this.decodedBuffers.set(url, buffer);
        return buffer;
      });
    this.buffers.set(url, bufferPromise);
    try {
      return await bufferPromise;
    } catch (error) {
      this.buffers.delete(url);
      throw error;
    }
  }

  private scheduleAtCurrentTime(state: EditorStoreState): void {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const now = context.currentTime;

    for (const { clip, trackMuted } of this.getAudibleTimelineClips(state)) {
      const clipEnd = clip.start + clip.duration;
      const timelineStart = Math.max(state.currentTime, clip.start);
      if (timelineStart >= clipEnd) continue;

      const buffer = this.peekBuffer(clip.mediaUrl!);
      if (!buffer) continue;
      const sourceRange = getAudioSourceRange(clip, buffer.duration);
      const playbackRate = sourceRange.duration / Math.max(0.01, clip.duration);
      const sourceOffset =
        sourceRange.start + (timelineStart - clip.start) * playbackRate;
      if (sourceRange.duration <= 0 || sourceOffset >= sourceRange.end) continue;

      const timelineRemaining = clipEnd - timelineStart;
      const sourceRemaining = (sourceRange.end - sourceOffset) / playbackRate;
      const duration = Math.min(timelineRemaining, sourceRemaining);
      if (duration <= 0) continue;

      const source = context.createBufferSource();
      const gain = context.createGain();
      const volume = clip.volume ?? 1;
      const signature = getClipSignature(clip, trackMuted);
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      gain.gain.value = Math.max(0, Math.min(5, volume));
      const stretchNode =
        Math.abs(playbackRate - 1) > 0.001
          ? new SoundTouchNode({ context })
          : undefined;
      if (stretchNode) {
        stretchNode.playbackRate.value = playbackRate;
        stretchNode.pitch.value = 1;
        source.connect(stretchNode);
        stretchNode.connect(gain);
      } else {
        source.connect(gain);
      }
      gain.connect(context.destination);

      const startAt = now + Math.max(0, clip.start - state.currentTime);
      source.start(startAt, sourceOffset);
      source.stop(startAt + duration);
      this.scheduled.set(clip.id, { source, gain, stretchNode, signature, volume });
      source.onended = () => {
        const scheduled = this.scheduled.get(clip.id);
        if (scheduled?.source === source) this.scheduled.delete(clip.id);
        source.disconnect();
        stretchNode?.disconnect();
        gain.disconnect();
      };
    }
  }

  private peekBuffer(url: string): AudioBuffer | null {
    return this.decodedBuffers.get(url) ?? null;
  }

  private hasScheduleChanged(previous: EditorStoreState, current: EditorStoreState): boolean {
    const oldClips = this.getAudibleTimelineClips(previous);
    const newClips = this.getAudibleTimelineClips(current);
    if (oldClips.length !== newClips.length) return true;
    return newClips.some(({ clip, trackMuted }) => {
      const old = oldClips.find((item) => item.clip.id === clip.id);
      return !old || getClipSignature(old.clip, old.trackMuted) !== getClipSignature(clip, trackMuted);
    });
  }

  private updateGains(state: EditorStoreState): void {
    const context = this.context;
    if (!context) return;

    for (const [clipId, scheduled] of this.scheduled) {
      const clip = state.clips[clipId];
      if (!clip) continue;
      const trackMuted = getTrackMuted(clip.trackId, state.tracks);
      if (clip.muted || trackMuted) continue;
      const volume = Math.max(0, Math.min(5, clip.volume ?? 1));
      if (volume !== scheduled.volume) {
        scheduled.gain.gain.setTargetAtTime(volume, context.currentTime, 0.015);
        scheduled.volume = volume;
      }
    }
  }

  private stopScheduled(): void {
    for (const { source, gain, stretchNode } of this.scheduled.values()) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      source.disconnect();
      stretchNode?.disconnect();
      gain.disconnect();
    }
    this.scheduled.clear();
  }
}
