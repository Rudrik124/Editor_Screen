import { useRef, useState, type PointerEvent } from "react";
import officialWatermarkUrl from "../../backend/app/brand/veytrix-watermark.png";
import { useEditorStore } from "../store/editor.store";
import type { WatermarkGeometry } from "../types/editor.types";
import { DEFAULT_WATERMARK, fitWatermarkToFrame } from "../utils/watermarkGeometry";
import { resolveAssetPreviewUrl } from "../services/backendApi";

interface WatermarkOverlayProps {
  selected: boolean;
  locked: boolean;
  pendingUrl: string | null;
  onSelect: () => void;
  frameAspectRatio: number;
}

export function WatermarkOverlay({ selected, locked, pendingUrl, onSelect, frameAspectRatio }: WatermarkOverlayProps) {
  const preferences = useEditorStore((state) => state.watermark);
  const watermark = locked ? DEFAULT_WATERMARK : preferences;
  const [image, setImage] = useState<{ src: string; ratio: number } | null>(null);
  const [draft, setDraft] = useState<WatermarkGeometry | null>(null);
  const drag = useRef<{
    pointerId: number;
    resize: boolean;
    startX: number;
    startY: number;
    frameWidth: number;
    frameHeight: number;
    initial: WatermarkGeometry;
    latest?: WatermarkGeometry;
  } | null>(null);
  const src = (locked ? null : pendingUrl) ?? (watermark.source === "custom"
    ? resolveAssetPreviewUrl(watermark.previewUrl)
    : officialWatermarkUrl);
  const logoRatio = image?.src === src ? image.ratio : 1;
  const fit = (geometry: WatermarkGeometry) => fitWatermarkToFrame(geometry, frameAspectRatio, logoRatio);
  const placement = fit((locked ? null : draft) ?? watermark);

  const commit = ({ x, y, width }: WatermarkGeometry) => {
    const state = useEditorStore.getState();
    state.setWatermark({ ...state.watermark, x, y, width });
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (locked || event.button !== 0 || drag.current) return;
    const frame = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!frame?.width || !frame.height) return;
    drag.current = {
      pointerId: event.pointerId,
      resize: event.target instanceof HTMLElement && event.target.classList.contains("watermark-resize"),
      startX: event.clientX,
      startY: event.clientY,
      frameWidth: frame.width,
      frameHeight: frame.height,
      initial: placement,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect();
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (gesture?.pointerId !== event.pointerId) return;
    const dx = (event.clientX - gesture.startX) / gesture.frameWidth;
    const dy = (event.clientY - gesture.startY) / gesture.frameHeight;
    const { x, y, width } = gesture.initial;
    const resizeDelta = Math.abs(dx) >= Math.abs(dy * logoRatio / frameAspectRatio)
      ? dx
      : dy * logoRatio / frameAspectRatio;
    gesture.latest = fit(gesture.resize
      ? { x, y, width: width + resizeDelta }
      : { x: x + dx, y: y + dy, width });
    setDraft(gesture.latest);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>, save: boolean) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const latest = drag.current.latest;
    drag.current = null;
    setDraft(null);
    if (save && latest && !locked) commit(latest);
  };

  if (!watermark.enabled) return null;

  return (
    <div
      className={`watermark-overlay${locked ? " is-locked" : selected ? " is-selected" : ""}`}
      style={{
        left: `${placement.x * 100}%`,
        top: `${placement.y * 100}%`,
        width: `${placement.width * 100}%`,
        height: `${placement.height * 100}%`,
      }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={(event) => finishDrag(event, true)}
      onPointerCancel={(event) => finishDrag(event, false)}
      onLostPointerCapture={(event) => finishDrag(event, false)}
    >
      <button
        type="button"
        className="watermark-select"
        aria-label="Select watermark"
        aria-pressed={selected}
        disabled={locked}
        onClick={onSelect}
        onKeyDown={(event) => {
          const offsets: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
          };
          const offset = offsets[event.key];
          if (!selected || !offset) return;
          event.preventDefault();
          const step = event.shiftKey ? 0.05 : 0.01;
          commit(fit({ ...placement, x: placement.x + offset[0] * step, y: placement.y + offset[1] * step }));
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          style={{ opacity: watermark.opacity }}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth && naturalHeight) setImage({ src, ratio: naturalWidth / naturalHeight });
          }}
        />
      </button>
      {selected && !locked && <span className="watermark-resize" aria-hidden="true" />}
    </div>
  );
}
