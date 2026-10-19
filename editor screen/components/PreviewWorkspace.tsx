import { EditorIcon } from "./EditorToolIcons";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatVideoTime } from "./utils/formatVideoTime";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";

interface PreviewWorkspaceProps {
  media: { url: string; type: "video" | "image"; name: string } | null;
  onPlaybackControllerReady: (controller: { isPlaying: boolean; toggle: () => void }) => void;
  textElements: TextElement[];
  onCurrentTimeChange: (time: number) => void;
}

export function PreviewWorkspace({ media, onPlaybackControllerReady, textElements, onCurrentTimeChange }: PreviewWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      void video.play().catch((error: unknown) => {
        console.error("Unable to play preview video.", error);
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
  }, []);

  useEffect(() => {
    onPlaybackControllerReady({ isPlaying, toggle: togglePlayback });
  }, [isPlaying, onPlaybackControllerReady, togglePlayback]);

  useEffect(() => {
    setCurrentTime(null);
    setDuration(null);
    setIsPlaying(false);
    videoRef.current?.pause();
  }, [media?.url]);

  const updateDuration = (video: HTMLVideoElement) => {
    if (Number.isFinite(video.duration) && video.duration >= 0) {
      setDuration(video.duration);
    }
  };

  const updateCurrentTime = (video: HTMLVideoElement) => {
    if (Number.isFinite(video.currentTime) && video.currentTime >= 0) {
      setCurrentTime(video.currentTime);
      onCurrentTimeChange(video.currentTime);
    }
  };

  return (
    <section className="preview-workspace">
      <div className="preview-canvas">
        {media ? media.type === "video" ? <video ref={videoRef} className="preview-media" src={media.url} playsInline preload="metadata" onLoadedMetadata={(event) => { updateDuration(event.currentTarget); updateCurrentTime(event.currentTarget); }} onDurationChange={(event) => updateDuration(event.currentTarget)} onPlay={() => setIsPlaying(true)} onPlaying={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={(event) => updateCurrentTime(event.currentTarget)} onEnded={(event) => { updateCurrentTime(event.currentTarget); setIsPlaying(false); }} onError={() => { console.error("Preview video failed to load or play."); setIsPlaying(false); }} /> : <img className="preview-media" src={media.url} alt={media.name} /> : <div className="preview-empty"><strong>Import media to start editing</strong><span>Choose a video or image from your media library.</span></div>}
        {textElements.filter((element) => currentTime !== null && currentTime >= element.start && currentTime < element.start + element.duration).map((element) => <div className="text-overlay" key={element.id} style={{ left: `${element.x}%`, top: `${element.y}%`, color: element.color, fontSize: `${element.fontSize}px`, fontWeight: element.bold ? 700 : 400, fontStyle: element.italic ? "italic" : "normal", textAlign: element.alignment }}>{element.content}</div>)}
      </div>
      <div className="preview-status"><span>{formatVideoTime(currentTime)} <b>/ {formatVideoTime(duration)}</b></span><span className="original"><span className="tiny-square" /> Original</span><EditorIcon name="fullscreen" /></div>
    </section>
  );
}
