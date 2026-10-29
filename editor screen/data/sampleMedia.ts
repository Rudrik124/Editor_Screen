export const SAMPLE_MEDIA = [
  {
    name: "Flower Sample (MP4)",
    duration: "00:05",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    extension: "mp4",
  },
  {
    name: "Flower Sample (WebM)",
    duration: "00:05",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
    extension: "webm",
  },
] as const;

export const DEFAULT_SAMPLE_MEDIA = SAMPLE_MEDIA[0];
