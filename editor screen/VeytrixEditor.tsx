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
import { VideoAsset, AudioAsset, ClipModel } from "./types/editor.types";
import { useTextElements } from "./left-side toolbar/functionality/text/functionality/useTextElements";
import { useEditorStore } from "./store/editor.store";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import { uploadAsset } from "./services/backendApi";
import { isImageMedia } from "./components/utils/previewResolver";
import { createAudioAsset } from "./left-side toolbar/functionality/Audio/functionality/createAudioAsset";
import { DEFAULT_SAMPLE_MEDIA } from "./data/sampleMedia";

export function VeytrixEditor() {
  // Bind global keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, S, Del, Space)
  useEditorKeyboardShortcuts();

  const [media, setMedia] = useState<{
    url: string;
    type: "video" | "image";
    name: string;
  } | null>({
    url: DEFAULT_SAMPLE_MEDIA.url,
    type: "video",
    name: "Flower Sample",
  });
  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [addedVideoIds, setAddedVideoIds] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const text = useTextElements();
  const [playbackController, setPlaybackController] = useState<{
    isPlaying: boolean;
    toggle: () => void;
  }>({ isPlaying: false, toggle: () => undefined });

  const videoAssetsRef = useRef<VideoAsset[]>([]);
  const audioAssetsRef = useRef<AudioAsset[]>([]);
  const mediaRef = useRef<typeof media>(null);

  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const clips = useEditorStore((state) => state.clips);
  const setCurrentStoreTime = useEditorStore((state) => state.setCurrentTime);
  const dispatch = useEditorStore((state) => state.dispatch);

  useEffect(() => {
    videoAssetsRef.current = videoAssets;
    audioAssetsRef.current = audioAssets;
    mediaRef.current = media;
  }, [media, videoAssets, audioAssets]);

  useEffect(() => () => {
    videoAssetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.url));
    audioAssetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.url));
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
      if (clip.type === "audio" || clip.type === "music") return;
      if (clip.mediaUrl) {
        const isImage = clip.mediaType === "image" || isImageMedia(clip.mediaUrl, clip.name);
        setMedia({
          url: clip.mediaUrl,
          type: isImage ? "image" : "video",
          name: clip.name,
        });
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

    const isImage = asset.mediaType === "image" || isImageMedia(asset.url, asset.name);

    const newClip: ClipModel = {
      id: `${isImage ? "image" : "video"}-${asset.id}`,
      trackId: "video",
      name: `${asset.name}  ${asset.duration.toFixed(2)}`,
      type: "video",
      mediaType: isImage ? "image" : "video",
      start,
      duration: asset.duration,
      color: isImage ? "#1e293b" : "#22262b",
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

  const addAudioAssetToStore = (asset: AudioAsset): boolean => {
    const state = useEditorStore.getState();
    const audioTrack = state.tracks.find(
      (track) => track.type === "audio" || track.type === "music"
    );
    if (!audioTrack || audioTrack.locked) {
      setUploadError("Unable to add audio: an unlocked Audio Track is required.");
      return false;
    }

    const start = audioTrack.clipIds.reduce((end, clipId) => {
      const clip = state.clips[clipId];
      return clip ? Math.max(end, clip.start + clip.duration) : end;
    }, 0);
    const clip: ClipModel = {
      id: `audio-${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trackId: audioTrack.id,
      name: asset.name,
      type: "audio",
      mediaType: "audio",
      start,
      duration: asset.duration,
      color: "#1e3a8a",
      mediaUrl: asset.url,
      renderMediaUrl: asset.renderUrl,
      assetId: asset.id,
      volume: 1,
      muted: false,
      inPoint: 0,
      outPoint: asset.duration,
      baseDuration: asset.duration,
    };
    const added = dispatch({
      id: `add-audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "ADD_CLIP",
      payload: { clip, trackId: audioTrack.id },
      timestamp: Date.now(),
    });
    if (!added) setUploadError("Unable to add the audio clip to the timeline.");
    return added;
  };

  const handleMediaSelected = async (file: File) => {
    setUploadError(null);
    if (file.type.startsWith("audio/")) {
      let asset: AudioAsset | undefined;
      try {
        asset = await createAudioAsset(file);
        const uploaded = await uploadAsset(file);
        const uploadedAudio: AudioAsset = {
          ...asset,
          id: uploaded.assetId || asset.id,
          renderUrl: uploaded.mediaUrl,
        };
        if (!addAudioAssetToStore(uploadedAudio)) {
          URL.revokeObjectURL(asset.url);
          return;
        }
        setAudioAssets((current) => [...current, uploadedAudio]);
      } catch (error) {
        if (asset) URL.revokeObjectURL(asset.url);
        console.error("Unable to import uploaded audio.", error);
        setUploadError(
          error instanceof Error ? error.message : "Unable to import this audio file."
        );
      }
      return;
    }

    if (file.type.startsWith("video/")) {
      try {
        const asset = await createVideoAsset(file);
        let renderUrl: string | undefined = undefined;
        try {
          const uploaded = await uploadAsset(file);
          renderUrl = uploaded.mediaUrl;
        } catch (uploadErr) {
          console.warn("Backend video upload deferred:", uploadErr);
        }
        const assetWithRenderUrl: VideoAsset = {
          ...asset,
          renderUrl: renderUrl || asset.url,
          mediaType: "video",
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

    if (file.type.startsWith("image/")) {
      try {
        const objectUrl = URL.createObjectURL(file);
        let renderUrl: string | undefined = undefined;
        try {
          const uploaded = await uploadAsset(file);
          renderUrl = uploaded.mediaUrl;
        } catch (uploadErr) {
          console.warn("Backend image upload deferred:", uploadErr);
        }

        const imageAsset: VideoAsset = {
          id: `image-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: objectUrl,
          renderUrl: renderUrl || objectUrl,
          name: file.name,
          duration: 4.0,
          thumbnailUrl: objectUrl,
          thumbnails: [objectUrl],
          mediaType: "image",
        };

        setVideoAssets((current) => [...current, imageAsset]);
        setAddedVideoIds((current) =>
          current.includes(imageAsset.id)
            ? current
            : [...current, imageAsset.id]
        );
        addAssetClipToStore(imageAsset);
        setMedia({
          url: imageAsset.url,
          type: "image",
          name: imageAsset.name,
        });
      } catch (error) {
        console.error("Unable to import uploaded image.", error);
        setUploadError(
          error instanceof Error ? error.message : "Unable to import this image."
        );
      }
      return;
    }

    setUploadError("Unsupported media type. Choose a video, image, or audio file.");
  };

  const addAudioToTimeline = (asset: AudioAsset) => {
    addAudioAssetToStore(asset);
  };

  const addVideoToTimeline = (asset: VideoAsset) => {
    setAddedVideoIds((current) =>
      current.includes(asset.id) ? current : [...current, asset.id]
    );
    addAssetClipToStore(asset);
    const isImage = asset.mediaType === "image" || isImageMedia(asset.url, asset.name);
    setMedia({
      url: asset.url,
      type: isImage ? "image" : "video",
      name: asset.name,
    });
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
            audioAssets={audioAssets}
            onAddVideo={addVideoToTimeline}
            onAddAudio={addAudioToTimeline}
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
