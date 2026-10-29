import { AudioAsset } from "../../../../types/editor.types";

function readAudioMetadata(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", handleMetadata);
      audio.removeEventListener("error", handleError);
    };
    const handleMetadata = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("The audio file metadata could not be loaded."));
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    audio.addEventListener("loadedmetadata", handleMetadata, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.load();
  });
}

export async function createAudioAsset(file: File): Promise<AudioAsset> {
  if (!file.type.startsWith("audio/")) {
    throw new Error("Please choose a supported audio file.");
  }

  const url = URL.createObjectURL(file);
  const audio = new Audio();
  audio.preload = "metadata";
  audio.src = url;

  try {
    await readAudioMetadata(audio);
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      throw new Error("The audio file has no valid duration.");
    }

    return {
      id: `audio-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      renderUrl: url,
      name: file.name,
      duration: audio.duration,
      mediaType: "audio",
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    audio.removeAttribute("src");
    audio.load();
  }
}
