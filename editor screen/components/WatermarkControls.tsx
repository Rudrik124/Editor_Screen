import { useId } from "react";
import { useEditorStore } from "../store/editor.store";

export function WatermarkControls({ uploading, error, onUpload }: {
  uploading: boolean;
  error: string | null;
  onUpload: (file: File) => void;
}) {
  const inputId = useId();
  const watermark = useEditorStore((state) => state.watermark);
  const setWatermark = useEditorStore((state) => state.setWatermark);

  return (
    <div className="watermark-controls">
      <label htmlFor={inputId}>{watermark.source === "custom" ? "Replace logo" : "Upload custom logo"}</label>
      <input
        id={inputId}
        type="file"
        accept=".png,image/png"
        disabled={uploading}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onUpload(file);
        }}
      />
      {uploading && <p role="status">Uploading logo…</p>}
      {error && <p className="watermark-error" role="alert">{error}</p>}
      <label>
        <span>Size <output>{Math.round(watermark.width * 100)}%</output></span>
        <input
          type="range" min="3" max="60" step="0.1"
          value={watermark.width * 100}
          onChange={(event) => setWatermark({ ...watermark, width: event.currentTarget.valueAsNumber / 100 })}
        />
      </label>
      <label>
        <span>Opacity <output>{Math.round(watermark.opacity * 100)}%</output></span>
        <input
          type="range" min="0" max="100"
          value={watermark.opacity * 100}
          onChange={(event) => setWatermark({ ...watermark, opacity: event.currentTarget.valueAsNumber / 100 })}
        />
      </label>
      <button
        type="button"
        disabled={uploading || watermark.source === "official"}
        onClick={() => setWatermark({ ...watermark, source: "official" })}
      >
        Restore official logo
      </button>
    </div>
  );
}
