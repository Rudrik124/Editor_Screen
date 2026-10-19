import "./styles/editor.css";
import "./styles/editor-layout-fixes.css";
import { useEffect, useRef, useState } from "react";
import { EditorHeader } from "./components/EditorHeader";
import { MediaLibrary } from "./components/MediaLibrary";
import { PlaybackBar } from "./components/PlaybackBar";
import { PreviewWorkspace } from "./components/PreviewWorkspace";
import { RightInspector } from "./components/RightInspector";
import { TimelineToolbar } from "./components/TimelineToolbar";
import { TimelineWorkspace } from "./components/TimelineWorkspace";
import { createVideoAsset } from "./left-side toolbar/functionality/Video/functionality/createVideoAsset";
import { VideoAsset } from "./types/editor.types";
import { useTextElements } from "./left-side toolbar/functionality/text/functionality/useTextElements";

export function VeytrixEditor() {
  const [media, setMedia] = useState<{ url: string; type: "video" | "image"; name: string } | null>(null);
  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [addedVideoIds, setAddedVideoIds] = useState<string[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const text = useTextElements();
  const [playbackController, setPlaybackController] = useState<{ isPlaying: boolean; toggle: () => void }>({ isPlaying: false, toggle: () => undefined });
  const videoAssetsRef = useRef<VideoAsset[]>([]);
  const mediaRef = useRef<typeof media>(null);

  useEffect(() => {
    videoAssetsRef.current = videoAssets;
    mediaRef.current = media;
  }, [media, videoAssets]);

  useEffect(() => () => {
    videoAssetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.url));
    if (mediaRef.current && !videoAssetsRef.current.some((asset) => asset.url === mediaRef.current?.url)) URL.revokeObjectURL(mediaRef.current.url);
  }, []);

  const handleMediaSelected = async (file: File) => {
    setUploadError(null);
    if (file.type.startsWith("video/")) {
      try {
        const asset = await createVideoAsset(file);
        setVideoAssets((current) => [...current, asset]);
        setAddedVideoIds((current) => current.includes(asset.id) ? current : [...current, asset.id]);
        setSelectedVideoId(asset.id);
        setMedia({ url: asset.url, type: "video", name: asset.name });
      } catch (error) {
        console.error("Unable to import uploaded video.", error);
        setUploadError(error instanceof Error ? error.message : "Unable to import this video.");
      }
      return;
    }

    if (media && !videoAssets.some((asset) => asset.url === media.url)) URL.revokeObjectURL(media.url);
    setMedia({ url: URL.createObjectURL(file), type: "image", name: file.name });
  };

  const addVideoToTimeline = (asset: VideoAsset) => {
    setAddedVideoIds((current) => current.includes(asset.id) ? current : [...current, asset.id]);
    setSelectedVideoId(asset.id);
    setMedia({ url: asset.url, type: "video", name: asset.name });
  };

  const selectText = (id: string) => {
    text.setSelectedId(id);
  };

  const resizeText = (id: string, edge: "left" | "right", time: number) => {
    const element = text.elements.find((candidate) => candidate.id === id);
    if (!element) return;
    const end = element.start + element.duration;
    if (edge === "left") {
      const start = Math.max(0, Math.min(end - 0.1, time));
      text.update(id, { start, duration: end - start });
    } else {
      const endTime = Math.max(element.start + 0.1, time);
      text.update(id, { duration: endTime - element.start });
    }
  };

  return <main className="veytrix-editor"><EditorHeader /><div className="editor-body"><div className="upper-workspace"><MediaLibrary onMediaSelected={handleMediaSelected} error={uploadError} /><PreviewWorkspace media={media} textElements={text.elements} onCurrentTimeChange={setCurrentTime} onPlaybackControllerReady={setPlaybackController} /><RightInspector selectedText={text.elements.find((element) => element.id === text.selectedId)} onUpdateText={text.update} onDeleteText={text.remove} /></div><PlaybackBar isPlaying={playbackController.isPlaying} onTogglePlayback={playbackController.toggle} /><div className="timeline-lower"><TimelineToolbar /><TimelineWorkspace assets={videoAssets} addedVideoIds={addedVideoIds} selectedVideoId={selectedVideoId} onAddVideo={addVideoToTimeline} onSelectVideo={(assetId) => { const asset = videoAssets.find((candidate) => candidate.id === assetId); if (asset) { setSelectedVideoId(asset.id); setMedia({ url: asset.url, type: "video", name: asset.name }); } }} textElements={text.elements} selectedTextId={text.selectedId} onSelectText={selectText} onAddText={text.add} onUpdateText={text.update} onDeleteText={text.remove} onResizeText={resizeText} /></div></div></main>;
}

export default VeytrixEditor;
