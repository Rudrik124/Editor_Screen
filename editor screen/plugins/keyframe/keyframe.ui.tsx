import React, { useState } from "react";
import { useKeyframeState } from "./keyframe.state";
import { KeyframeProcessor } from "./keyframe.processor";
import { KeyframeProperty } from "../../types/editor.types";

interface KeyframeInspectorProps {
  clipId: string;
}

export function KeyframeInspector({ clipId }: KeyframeInspectorProps) {
  const { clip, keyframes, localTime, canEdit } = useKeyframeState(clipId);
  const [property, setProperty] = useState<KeyframeProperty>("opacity");
  const [value, setValue] = useState<number>(1.0);
  const [interpolation, setInterpolation] = useState<"linear" | "easeIn" | "easeOut" | "easeInOut">("linear");

  if (!clip) return null;

  const handleAdd = () => {
    KeyframeProcessor.addKeyframeAtPlayhead(clipId, property, value, interpolation);
  };

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
        <span style={{ fontWeight: 600 }}>Keyframe Animation</span>
        <span style={{ fontSize: "11px", color: "#38bdf8" }}>Offset: {localTime.toFixed(2)}s</span>
      </div>

      {/* Add Keyframe Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr auto",
          gap: "6px",
          alignItems: "center",
          backgroundColor: "#16191f",
          padding: "8px",
          borderRadius: "4px",
        }}
      >
        <select
          value={property}
          onChange={(e) => setProperty(e.target.value as KeyframeProperty)}
          disabled={!canEdit}
          style={{
            backgroundColor: "#272c35",
            color: "#e2e8f0",
            border: "1px solid #3b4250",
            borderRadius: "4px",
            padding: "4px",
            fontSize: "11px",
          }}
        >
          <option value="opacity">Opacity</option>
          <option value="scale">Scale</option>
          <option value="positionX">Pos X</option>
          <option value="positionY">Pos Y</option>
          <option value="rotation">Rotation</option>
          <option value="volume">Volume</option>
        </select>

        <input
          type="number"
          step={property === "positionX" || property === "positionY" ? "5" : "0.1"}
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
          disabled={!canEdit}
          style={{
            backgroundColor: "#272c35",
            color: "#e2e8f0",
            border: "1px solid #3b4250",
            borderRadius: "4px",
            padding: "4px",
            fontSize: "11px",
            width: "100%",
          }}
        />

        <select
          value={interpolation}
          onChange={(e) => setInterpolation(e.target.value as any)}
          disabled={!canEdit}
          style={{
            backgroundColor: "#272c35",
            color: "#e2e8f0",
            border: "1px solid #3b4250",
            borderRadius: "4px",
            padding: "4px",
            fontSize: "11px",
          }}
        >
          <option value="linear">Linear</option>
          <option value="easeInOut">Ease I/O</option>
          <option value="easeIn">Ease In</option>
          <option value="easeOut">Ease Out</option>
        </select>

        <button
          type="button"
          disabled={!canEdit}
          onClick={handleAdd}
          style={{
            padding: "5px 8px",
            fontSize: "11px",
            fontWeight: 600,
            backgroundColor: "#0284c7",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Add ◆
        </button>
      </div>

      {/* Keyframe List */}
      <div>
        <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
          Active Keyframes ({keyframes.length})
        </label>
        {keyframes.length === 0 ? (
          <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", textAlign: "center", padding: "8px" }}>
            No keyframes yet. Position playhead and click "+ Add ◆"
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "150px", overflowY: "auto" }}>
            {keyframes.map((k) => (
              <div
                key={k.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "5px 8px",
                  backgroundColor: "#21262e",
                  borderRadius: "4px",
                  border: "1px solid #2d343f",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ color: "#38bdf8" }}>◆ {k.timeOffset.toFixed(2)}s</span>
                  <span style={{ color: "#cbd5e1" }}>{k.property}:</span>
                  <span style={{ fontWeight: 600 }}>{k.value}</span>
                  <span style={{ color: "#64748b", fontSize: "10px" }}>({k.interpolation || "linear"})</span>
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => KeyframeProcessor.removeKeyframe(clipId, k.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#f87171",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
