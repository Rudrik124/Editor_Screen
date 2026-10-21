import { VideoAsset } from "../../../../types/editor.types";

function readVideoMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleMetadata = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("The uploaded video metadata could not be loaded."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleMetadata);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadedmetadata", handleMetadata);
    video.addEventListener("error", handleError);
    video.load();
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("A frame could not be read from the uploaded video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = time;
  });
}

function captureFrame(video: HTMLVideoElement): string {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("The uploaded video has no readable video frames.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A canvas could not be created for the uploaded video.");

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function createVideoAsset(file: File): Promise<VideoAsset> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Please choose a supported video file.");
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await readVideoMetadata(video);
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("The uploaded video has no valid duration.");
    }

    const frameCount = Math.min(24, Math.max(8, Math.ceil(video.duration * 2)));
    const thumbnails: string[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      const time = frameCount === 1 ? 0 : (video.duration * index) / (frameCount - 1);
      await seekVideo(video, Math.min(time, Math.max(0, video.duration - 0.01)));
      thumbnails.push(captureFrame(video));
    }

    return {
      id: `${file.name}-${file.lastModified}-${url}`,
      url,
      name: file.name,
      duration: video.duration,
      thumbnailUrl: thumbnails[0],
      thumbnails,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}
