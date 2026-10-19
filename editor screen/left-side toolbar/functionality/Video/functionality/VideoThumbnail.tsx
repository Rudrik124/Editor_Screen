import { useEffect, useState } from "react";
import "./VideoThumbnail.css";

interface VideoThumbnailProps {
  media: { url: string; name: string } | null;
}

export function VideoThumbnail({ media }: VideoThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setThumbnailUrl(null);
    setFailed(false);

    if (!media) return;

    const sourceVideo = document.createElement("video");
    sourceVideo.preload = "metadata";
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;

    const handleMetadata = () => {
      const seekTime = Number.isFinite(sourceVideo.duration) && sourceVideo.duration > 0
        ? Math.min(0.1, sourceVideo.duration / 2)
        : 0;
      sourceVideo.currentTime = seekTime;
    };

    const captureFrame = () => {
      if (cancelled || sourceVideo.videoWidth === 0 || sourceVideo.videoHeight === 0) {
        if (!cancelled) {
          console.error("Unable to generate a thumbnail for the uploaded video.");
          setFailed(true);
        }
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = sourceVideo.videoWidth;
      canvas.height = sourceVideo.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        console.error("Unable to create a canvas for the uploaded video thumbnail.");
        setFailed(true);
        return;
      }

      context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
      objectUrl = canvas.toDataURL("image/jpeg", 0.82);
      if (!cancelled) setThumbnailUrl(objectUrl);
    };

    const handleError = () => {
      if (!cancelled) {
        console.error("The uploaded video does not support thumbnail generation.");
        setFailed(true);
      }
    };

    sourceVideo.addEventListener("loadedmetadata", handleMetadata);
    sourceVideo.addEventListener("seeked", captureFrame, { once: true });
    sourceVideo.addEventListener("error", handleError);
    sourceVideo.src = media.url;
    sourceVideo.load();

    return () => {
      cancelled = true;
      sourceVideo.pause();
      sourceVideo.removeAttribute("src");
      sourceVideo.load();
      if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [media]);

  if (!media) return null;

  return (
    <div className="video-thumbnail" title={media.name} aria-label={`Uploaded video: ${media.name}`}>
      {thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : <span className="video-thumbnail-fallback">{failed ? "!" : "..."}</span>}
      <span className="video-thumbnail-name">{media.name}</span>
    </div>
  );
}
