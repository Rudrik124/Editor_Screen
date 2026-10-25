import React from "react";
import { useOverlapState } from "./overlap.state";
import { OverlapProcessor, PipPreset } from "./overlap.processor";

interface OverlapInspectorProps {
  clipId: string;
}

export function OverlapInspector({ clipId }: OverlapInspectorProps) {
  const { clip, currentTrack, scale, positionX, positionY, rotation, opacity, canEdit } =
    useOverlapState(clipId);

  if (!clip) return null;

  const isOverlay = currentTrack?.id.includes("overlay");

  const presets: { id: PipPreset; label: string }[] = [
    { id: "top-right", label: "↗ Top Right" },
    { id: "top-left", label: "↖ Top Left" },
    { id: "bottom-right", label: "↘ Bottom Right" },
    { id: "bottom-left", label: "↙ Bottom Left" },
    { id: "center", label: "⊙ Center" },
    { id: "reset", label: "↺ Reset" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "14px",
        backgroundColor: "#1c2026",
        borderRadius: "6px",
        color: "#e2e8f0",
        fontSize: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Picture-in-Picture & Transform</span>
        {!isOverlay && (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => OverlapProcessor.moveToOverlayTrack(clipId)}
            style={{
              padding: "4px 8px",
              fontSize: "10px",
              backgroundColor: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            + Move to PIP
          </button>
        )}
      </div>

      {/* Preset Grid */}
      <div>
        <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
          PIP Position Presets
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={!canEdit}
              onClick={() => OverlapProcessor.applyPipPreset(clipId, p.id)}
              style={{
                padding: "6px 4px",
                fontSize: "10px",
                backgroundColor: "#272c35",
                color: "#cbd5e1",
                border: "1px solid #3b4250",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#94a3b8" }}>Scale</span>
            <span>{scale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.05"
            value={scale}
            disabled={!canEdit}
            onChange={(e) =>
              OverlapProcessor.setTransform({ clipId, scale: parseFloat(e.target.value) })
            }
            style={{ width: "100%", accentColor: "#38bdf8" }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#94a3b8" }}>Position X</span>
            <span>{Math.round(positionX)}px</span>
          </div>
          <input
            type="range"
            min="-500"
            max="500"
            step="5"
            value={positionX}
            disabled={!canEdit}
            onChange={(e) =>
              OverlapProcessor.setTransform({ clipId, positionX: parseFloat(e.target.value) })
            }
            style={{ width: "100%", accentColor: "#38bdf8" }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#94a3b8" }}>Position Y</span>
            <span>{Math.round(positionY)}px</span>
          </div>
          <input
            type="range"
            min="-400"
            max="400"
            step="5"
            value={positionY}
            disabled={!canEdit}
            onChange={(e) =>
              OverlapProcessor.setTransform({ clipId, positionY: parseFloat(e.target.value) })
            }
            style={{ width: "100%", accentColor: "#38bdf8" }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#94a3b8" }}>Opacity</span>
            <span>{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={opacity}
            disabled={!canEdit}
            onChange={(e) =>
              OverlapProcessor.setTransform({ clipId, opacity: parseFloat(e.target.value) })
            }
            style={{ width: "100%", accentColor: "#38bdf8" }}
          />
        </div>
      </div>
    </div>
  );
}
