import { EditorIcon } from "./EditorToolIcons";
import { UndoRedoToolbarButtons } from "../plugins/undo-redo";

interface PlaybackBarProps {
  isPlaying: boolean;
  onTogglePlayback: () => void;
}

export function PlaybackBar({ isPlaying, onTogglePlayback }: PlaybackBarProps) {
  return (
    <div className="playback-bar">
      {/* Functional Undo/Redo on the left */}
      <div className="playback-left">
        <UndoRedoToolbarButtons />
      </div>

      {/* Center Transport controls without duplicate arrows */}
      <div className="transport">
        <button
          className="play-button"
          aria-label={isPlaying ? "Pause video" : "Play video"}
          onClick={onTogglePlayback}
          type="button"
        >
          <EditorIcon name={isPlaying ? "pause" : "play"} size={18} />
        </button>
      </div>

      {/* Right controls */}
      <div className="playback-right">
        <button className="accent" type="button">
          <EditorIcon name="link" />
        </button>
        <button className="accent" type="button">
          <EditorIcon name="snap" />
        </button>
        <button type="button">
          <EditorIcon name="settings" />
        </button>
        <button type="button">
          <EditorIcon name="grid" />
        </button>
        <button type="button">
          <EditorIcon name="zoomOut" />
        </button>
        <input aria-label="Timeline zoom" type="range" defaultValue="32" />
        <button type="button">
          <EditorIcon name="zoomIn" />
        </button>
        <span className="chevron">⌃</span>
      </div>
    </div>
  );
}
