import { useEditorStore } from "../../store/editor.store";
import { createReplaceClipCommand } from "./replace.command";
import { uploadAsset } from "../../services/backendApi";

export const ReplaceProcessor = {
  replaceWithAsset: (
    clipId: string,
    asset: { url: string; id?: string; name?: string; duration?: number; thumbnails?: string[] }
  ): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const cmd = createReplaceClipCommand({
      clipId,
      newMediaUrl: asset.url,
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
      // Attempt backend upload in background
      uploadAsset(file)
        .then((uploaded) => {
          ReplaceProcessor.replaceWithAsset(clipId, {
            url: uploaded.mediaUrl || blobUrl,
            id: uploaded.assetId,
            name: uploaded.filename || file.name,
          });
        })
        .catch(() => {
          // Fall back to local blob URL
          ReplaceProcessor.replaceWithAsset(clipId, {
            url: blobUrl,
            name: file.name,
          });
        });

      return true;
    } catch (e) {
      console.warn("Failed to replace clip with file:", e);
      return false;
    }
  },
};
