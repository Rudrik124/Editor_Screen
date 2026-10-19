import { IconName } from "../types/editor.types";

const paths: Record<IconName, string> = {
  audio: "M9 18V5l10-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z",
  crop: "M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14",
  duplicate: "M8 8h12v12H8zM4 16H2V2h14v2",
  effects: "m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Zm7 14 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z",
  filter: "M3 5h18M6 12h12M10 19h4",
  flip: "M3 5h7v14H3zM14 5h7v14h-7z",
  fullscreen: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  image: "M4 5h16v14H4zM7 15l3-3 2 2 2-2 3 3M8 9h.01",
  link: "M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1",
  lock: "M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3",
  mask: "M4 5h16v14H4zM8 10h.01M16 10h.01M8 15c2 1 6 1 8 0",
  pause: "M8 5v14M16 5v14",
  play: "m9 6 9 6-9 6z",
  redo: "m17 7 4 4-4 4M3 18v-1a6 6 0 0 1 6-6h12",
  rotate: "M4 9a8 8 0 1 1 2 7M4 4v5h5",
  search: "m20 20-4-4m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  snap: "M5 3v5a7 7 0 0 0 14 0V3M8 3v5a4 4 0 0 0 8 0V3M12 3v18",
  speed: "M4 17a8 8 0 1 1 16 0M12 13l4-4M12 20v-1",
  split: "M12 3v18M5 7h5v5H5zM14 12h5v5h-5z",
  text: "M5 5h14M12 5v14M8 19h8",
  transform: "M4 4h6v6H4zM14 14h6v6h-6zM14 4h6M20 4v6M4 20h6M4 20v-6",
  undo: "m7 7-4 4 4 4M21 18v-1a6 6 0 0 0-6-6H3",
  video: "M3 6h13v12H3zM16 10l5-3v10l-5-3z",
  volume: "M4 10v4h4l5 4V6L8 10H4Zm13.5-3a5 5 0 0 1 0 10M20 4a9 9 0 0 1 0 16",
  zoomIn: "M11 5v12M5 11h12M20 20l-4-4",
  zoomOut: "M5 11h12M20 20l-4-4",
};

export function EditorIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="editor-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
