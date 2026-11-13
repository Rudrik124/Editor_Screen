import { useEditorStore } from "../../store/editor.store";
import { commandBus } from "../../store/command.bus";
import { transcribeMedia } from "../../services/captionsApi";
import { CaptionItem } from "../../types/editor.types";
import { resolveActiveClips } from "../../components/utils/previewResolver";

export function formatSrtTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function generateSrtContent(captions: CaptionItem[]): string {
  const sorted = [...captions].sort((a, b) => a.startTime - b.startTime);
  const lines: string[] = [];
  sorted.forEach((cap, i) => {
    lines.push(String(i + 1));
    lines.push(`${formatSrtTimestamp(cap.startTime)} --> ${formatSrtTimestamp(cap.endTime)}`);
    lines.push(cap.text);
    lines.push("");
  });
  return lines.join("\n");
}

export const CaptionProcessor = {
  /**
   * Auto-transcribe video speech to word-level synchronized captions via Whisper backend
   */
  autoTranscribe: async (clipId?: string, language = "en"): Promise<CaptionItem[]> => {
    const state = useEditorStore.getState();
    const activeClip = resolveActiveClips(state.tracks, state.clips, state.currentTime).activeVideoClip;
    const targetClipId = clipId || state.selectedClipId || activeClip?.id;

    if (!targetClipId) {
      throw new Error("Select a video clip to generate automatic captions.");
    }

    const clip = state.clips[targetClipId];
    if (!clip) {
      throw new Error(`Clip ${targetClipId} not found.`);
    }

    const mediaUrl = clip.mediaUrl || clip.renderMediaUrl;
    if (!mediaUrl) {
      throw new Error("The selected clip does not contain a playable media URL to transcribe.");
    }

    const result = await transcribeMedia(mediaUrl, language);

    const captions: CaptionItem[] = (result.segments || []).map((seg, idx) => ({
      id: seg.id || `cap-${clip.id}-${idx + 1}`,
      text: seg.text,
      startTime: seg.start,
      endTime: seg.end,
      words: seg.words,
    }));

    if (captions.length === 0) {
      throw new Error("No speech detected in this media clip.");
    }

    commandBus.createAndDispatch("ADD_CAPTION", {
      clipId: clip.id,
      captions,
    });

    return captions;
  },

  /**
   * Update an individual caption text or timing
   */
  updateCaption: (clipId: string, captionId: string, updates: Partial<CaptionItem>): boolean => {
    return commandBus.createAndDispatch("UPDATE_CAPTION", {
      clipId,
      captionId,
      updates,
    });
  },

  /**
   * Remove an individual caption
   */
  removeCaption: (clipId: string, captionId: string): boolean => {
    return commandBus.createAndDispatch("REMOVE_CAPTION", {
      clipId,
      captionId,
    });
  },

  /**
   * Manually add a new caption
   */
  addManualCaption: (clipId: string, text: string, startTime: number, endTime: number): boolean => {
    const newCap: CaptionItem = {
      id: `cap-${clipId}-${Date.now()}`,
      text,
      startTime,
      endTime,
    };
    return commandBus.createAndDispatch("ADD_CAPTION", {
      clipId,
      captions: [newCap],
    });
  },

  /**
   * Format captions into SubRip (.srt) subtitle string
   */
  exportSrt: (captions: CaptionItem[]): string => {
    return generateSrtContent(captions);
  },

  /**
   * Download .srt subtitle file in the browser
   */
  downloadSrt: (captions: CaptionItem[], filename = "subtitles.srt"): void => {
    const srt = generateSrtContent(captions);
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * AI Tool intent executor: "generate captions for the video" or "add subtitles in English"
   */
  executeAiTool: async (
    prompt: string,
    clipId?: string
  ): Promise<{ success: boolean; message: string; captions?: CaptionItem[] }> => {
    const lower = prompt.toLowerCase();
    const isCaptionIntent =
      lower.includes("caption") ||
      lower.includes("subtitle") ||
      lower.includes("transcribe") ||
      lower.includes("subtitles");

    if (!isCaptionIntent) {
      return { success: false, message: "Unrecognized caption tool prompt." };
    }

    let lang = "en";
    if (lower.includes("spanish")) lang = "es";
    else if (lower.includes("french")) lang = "fr";
    else if (lower.includes("german")) lang = "de";
    else if (lower.includes("japanese")) lang = "ja";
    else if (lower.includes("hindi")) lang = "hi";

    try {
      const captions = await CaptionProcessor.autoTranscribe(clipId, lang);
      return {
        success: true,
        message: `Generated ${captions.length} subtitles in ${lang.toUpperCase()}.`,
        captions,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Auto-caption failed: ${msg}` };
    }
  },
};

