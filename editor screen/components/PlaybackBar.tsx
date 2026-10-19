import { EditorIcon } from "./EditorToolIcons";

interface PlaybackBarProps {
  isPlaying: boolean;
  onTogglePlayback: () => void;
}

export function PlaybackBar({ isPlaying, onTogglePlayback }: PlaybackBarProps) {
  return <div className="playback-bar"><div className="playback-left"><button aria-label="Undo"><EditorIcon name="undo" /></button><button aria-label="Redo"><EditorIcon name="redo" /></button></div><div className="transport"><button><EditorIcon name="undo" /></button><button className="play-button" aria-label={isPlaying ? "Pause video" : "Play video"} onClick={onTogglePlayback}><EditorIcon name={isPlaying ? "pause" : "play"} size={18} /></button><button><EditorIcon name="redo" /></button></div><div className="playback-right"><button className="accent"><EditorIcon name="link" /></button><button className="accent"><EditorIcon name="snap" /></button><button><EditorIcon name="settings" /></button><button><EditorIcon name="grid" /></button><button><EditorIcon name="zoomOut" /></button><input aria-label="Timeline zoom" type="range" defaultValue="32" /><button><EditorIcon name="zoomIn" /></button><span className="chevron">⌃</span></div></div>;
}
