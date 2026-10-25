import { useState } from "react";
import { Magnet, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { BottomToolbar } from "../bottom tool bar";

export function TimelineToolbar() {
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  return (
    <div className="timeline-tools">
      {/* Left: Primary Editing Command Tools */}
      <div className="timeline-tools-left">
        <BottomToolbar />
      </div>

      {/* Right: Timeline Snapping and Zoom Controls */}
      <div className="timeline-tools-right">
        {/* Magnetic Snapping */}
        <button
          type="button"
          className={`timeline-snap-btn ${snapEnabled ? "active" : ""}`}
          title={snapEnabled ? "Magnetic Snap: Enabled (Click to disable)" : "Magnetic Snap: Disabled (Click to enable)"}
          onClick={() => setSnapEnabled(!snapEnabled)}
          aria-label="Toggle magnetic snap"
        >
          <Magnet size={14} weight={snapEnabled ? "fill" : "regular"} />
          <span className="snap-label">Snap</span>
        </button>

        <div className="timeline-tool-separator" />

        {/* Zoom Controls */}
        <div className="timeline-zoom-controls">
          <button
            type="button"
            className="zoom-step-btn"
            title="Zoom Out"
            onClick={() => setZoomLevel((z) => Math.max(25, z - 25))}
            aria-label="Zoom out timeline"
          >
            <MagnifyingGlassMinus size={13} weight="bold" />
          </button>
          <input
            type="range"
            min="25"
            max="300"
            step="25"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseInt(e.target.value, 10))}
            className="zoom-slider"
            title={`Timeline Zoom: ${zoomLevel}%`}
            aria-label="Timeline zoom slider"
          />
          <button
            type="button"
            className="zoom-step-btn"
            title="Zoom In"
            onClick={() => setZoomLevel((z) => Math.min(300, z + 25))}
            aria-label="Zoom in timeline"
          >
            <MagnifyingGlassPlus size={13} weight="bold" />
          </button>
          <span className="zoom-readout">{zoomLevel}%</span>
        </div>
      </div>
    </div>
  );
}
