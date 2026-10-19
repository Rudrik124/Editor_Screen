import { Track } from "../types/editor.types";

export const timelineDuration = 9.66;

export const timelineTracks: Track[] = [
  {
    id: "music-primary",
    label: "Music",
    type: "music",
    clips: [
      {
        id: "music-primary-clip",
        label: "Music  9.66",
        type: "music",
        start: 0,
        duration: timelineDuration,
        color: "#252b30",
      },
    ],
  },
  {
    id: "text",
    label: "Text",
    type: "text",
    clips: [
      {
        id: "text-clip",
        label: "Text  9.66",
        type: "text",
        start: 0,
        duration: timelineDuration,
        color: "#075c61",
      },
    ],
  },
  {
    id: "overlay-clip",
    label: "Overlay Clip",
    type: "video",
    clips: [
      {
        id: "overlay-clip-clip",
        label: "Overlay Clip  9.66",
        type: "video",
        start: 0,
        duration: timelineDuration,
        color: "#22262b",
        thumbnails: Array.from({ length: 12 }, (_, index) => `frame-${index + 1}`),
      },
    ],
  },
  {
    id: "video",
    label: "Video",
    type: "video",
    clips: [
      {
        id: "video-clip",
        label: "Video  9.66",
        type: "video",
        start: 0,
        duration: timelineDuration,
        color: "#22262b",
        thumbnails: Array.from({ length: 12 }, (_, index) => `frame-${index + 1}`),
      },
    ],
  },
  {
    id: "audio",
    label: "Audio",
    type: "audio",
    clips: [
      {
        id: "audio-clip",
        label: "",
        type: "audio",
        start: 0,
        duration: timelineDuration,
        color: "#38351b",
      },
    ],
  },
];

export const rulerLabels = Array.from({ length: 10 }, (_, index) => `00:0${index}`);
