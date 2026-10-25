import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/timeline.css";
import "./styles/editor-layout-fixes.css";
import { useEffect, useRef, useState } from "react";
import { EditorHeader } from "./components/EditorHeader";
import { MediaLibrary } from "./components/MediaLibrary";
import { PreviewWorkspace } from "./components/PreviewWorkspace";
import { RightInspector } from "./components/RightInspector";
import { TimelineToolbar } from "./components/TimelineToolbar";
import { TimelineWorkspace } from "./components/TimelineWorkspace";
import { MobileToolDock } from "./components/MobileToolDock";
import { createVideoAsset } from "./left-side toolbar/functionality/Video/functionality/createVideoAsset";
import { VideoAsset, ClipModel } from "./types/editor.types";
import { useTextElements } from "./left-side toolbar/functionality/text/functionality/useTextElements";
import { useEditorStore } from "./store/editor.store";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import { uploadAsset } from "./services/backendApi";

export function VeytrixEditor() {
  // Bind global keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, S, Del, Space)
  useEditorKeyboardShortcuts();

  const [media, setMedia] = useState<{
    url: string;
    type: "video" | "image";
    name: string;
  } | null>({
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    type: "video",
    name: "Nature Drone Footage",
  });
  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [addedVideoIds, setAddedVideoIds] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const text = useTextElements();
  const [playbackController, setPlaybackController] = useState<{
    isPlaying: boolean;
    toggle: () => void;
  }>({ isPlaying: false, toggle: () => undefined });

  const videoAssetsRef = useRef<VideoAsset[]>([]);
  const mediaRef = useRef<typeof media>(null);

  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const clips = useEditorStore((state) => state.clips);
  const setCurrentStoreTime = useEditorStore((state) => state.setCurrentTime);
  const dispatch = useEditorStore((state) => state.dispatch);

  useEffect(() => {
    videoAssetsRef.current = videoAssets;
    mediaRef.current = media;
  }, [media, videoAssets]);

  useEffect(() => () => {
    videoAssetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.url));
    if (
      mediaRef.current &&
      !videoAssetsRef.current.some((asset) => asset.url === mediaRef.current?.url)
    ) {
      URL.revokeObjectURL(mediaRef.current.url);
    }
  }, []);

  // Sync preview media if selected clip changes
  useEffect(() => {
    if (selectedClipId && clips[selectedClipId]) {
      const clip = clips[selectedClipId];
      if (clip.mediaUrl) {
        setMedia({ url: clip.mediaUrl, type: "video", name: clip.name });
      }
    }
  }, [selectedClipId, clips]);

  const addAssetClipToStore = (asset: VideoAsset) => {
    const videoTrack = useEditorStore
      .getState()
      .tracks.find((t) => t.id === "video");
    const existingClips = videoTrack
      ? videoTrack.clipIds
          .map((id) => useEditorStore.getState().clips[id])
          .filter(Boolean)
      : [];
    const start = existingClips.reduce(
      (max, c) => Math.max(max, c.start + c.duration),
      0
    );

    const newClip: ClipModel = {
      id: `video-${asset.id}`,
      trackId: "video",
      name: `${asset.name}  ${asset.duration.toFixed(2)}`,
      type: "video",
      start,
      duration: asset.duration,
      color: "#22262b",
      thumbnails: asset.thumbnails,
      rawThumbnails: asset.thumbnails,
      mediaUrl: asset.url,
      renderMediaUrl: asset.renderUrl,
      assetId: asset.id,
      inPoint: 0,
      outPoint: asset.duration,
      baseDuration: asset.duration,
      speed: 1.0,
      reverse: false,
      isFrozen: false,
    };

    dispatch({
      id: `add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: "ADD_CLIP",
      payload: {
        clip: newClip,
        trackId: "video",
      },
      timestamp: Date.now(),
    });
  };

  const handleMediaSelected = async (file: File) => {
    setUploadError(null);
    if (file.type.startsWith("video/")) {
      try {
        const asset = await createVideoAsset(file);
        const uploaded = await uploadAsset(file);
        const assetWithRenderUrl = {
          ...asset,
          renderUrl: uploaded.mediaUrl,
        };
        setVideoAssets((current) => [...current, assetWithRenderUrl]);
        setAddedVideoIds((current) =>
          current.includes(assetWithRenderUrl.id)
            ? current
            : [...current, assetWithRenderUrl.id]
        );
        addAssetClipToStore(assetWithRenderUrl);
        setMedia({
          url: assetWithRenderUrl.url,
          type: "video",
          name: assetWithRenderUrl.name,
        });
      } catch (error) {
        console.error("Unable to import uploaded video.", error);
        setUploadError(
          error instanceof Error ? error.message : "Unable to import this video."
        );
      }
      return;
    }

    if (media && !videoAssets.some((asset) => asset.url === media.url)) {
      URL.revokeObjectURL(media.url);
    }
    setMedia({
      url: URL.createObjectURL(file),
      type: "image",
      name: file.name,
    });
  };

  const addVideoToTimeline = (asset: VideoAsset) => {
    setAddedVideoIds((current) =>
      current.includes(asset.id) ? current : [...current, asset.id]
    );
    addAssetClipToStore(asset);
    setMedia({ url: asset.url, type: "video", name: asset.name });
  };

  const selectText = (id: string) => {
    text.setSelectedId(id);
    useEditorStore.getState().selectClip(id);
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

  return (
    <main className="veytrix-editor">
      <EditorHeader />
      <div className="editor-body">
        <div className="upper-workspace">
          <MediaLibrary
            onMediaSelected={handleMediaSelected}
            error={uploadError}
            videoAssets={videoAssets}
            onAddVideo={addVideoToTimeline}
            onAddText={text.add}
          />
          <PreviewWorkspace
            media={media}
            textElements={text.elements}
            onCurrentTimeChange={(t) => setCurrentStoreTime(t)}
            onPlaybackControllerReady={setPlaybackController}
          />
          <RightInspector
            selectedText={text.elements.find(
              (element) => element.id === text.selectedId
            )}
            onUpdateText={text.update}
            onDeleteText={text.remove}
          />
        </div>
        <div className="timeline-lower">
          <TimelineToolbar />
          <TimelineWorkspace
            assets={videoAssets}
            addedVideoIds={addedVideoIds}
            selectedVideoId={selectedClipId?.replace(/^video-/, "")}
            onAddVideo={addVideoToTimeline}
            onSelectVideo={(assetId) => {
              const asset = videoAssets.find(
                (candidate) => candidate.id === assetId
              );
              if (asset) {
                setMedia({ url: asset.url, type: "video", name: asset.name });
              }
            }}
            textElements={text.elements}
            selectedTextId={text.selectedId}
            onSelectText={selectText}
            onAddText={text.add}
            onUpdateText={text.update}
            onDeleteText={text.remove}
            onResizeText={resizeText}
          />
        </div>
      </div>
      <MobileToolDock
        onMediaSelected={handleMediaSelected}
        onAddText={text.add}
        videoAssets={videoAssets}
        onAddVideo={addVideoToTimeline}
      />
    </main>
  );
}

export default VeytrixEditor;

