import { useEditorStore } from "../../store/editor.store";
import { createReplaceClipCommand } from "./replace.command";
import { uploadAsset } from "../../services/backendApi";

export const ReplaceProcessor = {
  replaceWithAsset: (
    clipId: string,
    asset: { url: string; renderUrl?: string; id?: string; name?: string; duration?: number; thumbnails?: string[] }
  ): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const cmd = createReplaceClipCommand({
      clipId,
      newMediaUrl: asset.url,
      newRenderMediaUrl: asset.renderUrl || (asset.url.startsWith("blob:") ? undefined : asset.url),
      newAssetId: asset.id,
      newName: asset.name,
      newDuration: asset.duration,
      newThumbnails: asset.thumbnails,
    });

    return state.dispatch(cmd);
  },

  replaceWithFile: async (clipId: string, file: File): Promise<boolean> => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    try {
      const blobUrl = URL.createObjectURL(file);
      // Immediately set preview with blob URL
      ReplaceProcessor.replaceWithAsset(clipId, {
        url: blobUrl,
        name: file.name,
      });

      // Upload in background to obtain permanent backend storage renderMediaUrl
      uploadAsset(file)
        .then((uploaded) => {
          ReplaceProcessor.replaceWithAsset(clipId, {
            url: blobUrl,
            renderUrl: uploaded.mediaUrl,
            id: uploaded.assetId,
            name: uploaded.filename || file.name,
          });
        })
        .catch((err) => {
          console.warn("Background upload for replaced clip failed:", err);
        });

      return true;
    } catch (e) {
      console.warn("Failed to replace clip with file:", e);
      return false;
    }
  },
};
