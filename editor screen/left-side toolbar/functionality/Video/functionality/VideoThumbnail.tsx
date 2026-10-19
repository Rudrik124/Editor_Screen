import { VideoAsset } from "../../../../types/editor.types";
import "./VideoThumbnail.css";

interface VideoThumbnailProps {
  assets: VideoAsset[];
  onAdd: (asset: VideoAsset) => void;
}

export function VideoThumbnail({ assets, onAdd }: VideoThumbnailProps) {
  return (
    <div className="video-assets" aria-label="Uploaded videos">
      {assets.map((asset) => (
        <button className="video-thumbnail" type="button" key={asset.id} title={`Add ${asset.name} to the timeline`} onClick={() => onAdd(asset)} draggable onDragStart={(event) => event.dataTransfer.setData("text/video-asset-id", asset.id)}>
          <img src={asset.thumbnailUrl} alt="" />
          <span className="video-thumbnail-name">{asset.name}</span>
        </button>
      ))}
    </div>
  );
}
