import "./styles/editor.css";
import "./styles/editor-layout-fixes.css";
import { useEffect, useState } from "react";
import { EditorHeader } from "./components/EditorHeader";
import { MediaLibrary } from "./components/MediaLibrary";
import { PlaybackBar } from "./components/PlaybackBar";
import { PreviewWorkspace } from "./components/PreviewWorkspace";
import { RightInspector } from "./components/RightInspector";
import { TimelineToolbar } from "./components/TimelineToolbar";
import { TimelineWorkspace } from "./components/TimelineWorkspace";

export function VeytrixEditor() {
  const [media, setMedia] = useState<{ url: string; type: "video" | "image"; name: string } | null>(null);
  const [playbackController, setPlaybackController] = useState<{ isPlaying: boolean; toggle: () => void }>({ isPlaying: false, toggle: () => undefined });

  useEffect(() => () => { if (media) URL.revokeObjectURL(media.url); }, [media]);

  const handleMediaSelected = (file: File) => {
    if (media) URL.revokeObjectURL(media.url);
    setMedia({ url: URL.createObjectURL(file), type: file.type.startsWith("video/") ? "video" : "image", name: file.name });
  };

  return <main className="veytrix-editor"><EditorHeader /><div className="editor-body"><div className="upper-workspace"><MediaLibrary onMediaSelected={handleMediaSelected} /><PreviewWorkspace media={media} onPlaybackControllerReady={setPlaybackController} /><RightInspector /></div><PlaybackBar isPlaying={playbackController.isPlaying} onTogglePlayback={playbackController.toggle} /><div className="timeline-lower"><TimelineToolbar /><TimelineWorkspace media={media?.type === "video" ? media : null} /></div></div></main>;
}

export default VeytrixEditor;
