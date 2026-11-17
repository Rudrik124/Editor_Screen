import { useEffect, useState } from "react";
import { useEditorStore } from "../store/editor.store";
import { ClipModel, TrackModel } from "../types/editor.types";

const KEY = "veytrix-editor-project-v1";

export function useLocalProject() {
  const [status, setStatus] = useState("Saving locally…");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const project = JSON.parse(saved);
        if (!Array.isArray(project.tracks) || !project.clips || typeof project.clips !== "object") throw new Error("Invalid project");
        const clips = project.clips as Record<string, ClipModel>;
        const tracks = project.tracks as TrackModel[];
        if (!tracks.every(t => typeof t.id === "string" && Array.isArray(t.clipIds)) ||
          !Object.values(clips).every(c => typeof c.id === "string" && Number.isFinite(c.start) && Number.isFinite(c.duration) && c.duration > 0)) throw new Error("Invalid project");
        useEditorStore.setState({ tracks, clips, duration: Math.max(0, ...Object.values(clips).map(c => c.start + c.duration)),
          history: [], future: [], selectedClipId: null, currentTime: 0,
          ...(["16:9", "9:16", "1:1", "4:5", "21:9"].includes(project.aspectRatio) ? { aspectRatio: project.aspectRatio } : {}) });
      }
      setStatus("Saved locally");
    } catch {
      setStatus("Local project could not be restored");
    }
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.clips === previous.clips && state.tracks === previous.tracks && state.aspectRatio === previous.aspectRatio) return;
      try {
        const clips = Object.fromEntries(Object.entries(state.clips).map(([id, clip]) => [id, {
          ...clip, mediaUrl: clip.renderMediaUrl || (clip.mediaUrl?.startsWith("blob:") ? undefined : clip.mediaUrl),
        }]));
        localStorage.setItem(KEY, JSON.stringify({ tracks: state.tracks, clips, aspectRatio: state.aspectRatio }));
        setStatus("Saved locally");
      } catch { setStatus("Local save failed"); }
    });
    return unsubscribe;
  }, []);
  return status;
}
