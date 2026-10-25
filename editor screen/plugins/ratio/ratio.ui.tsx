import React, { useState } from "react";
import { useRatioState } from "./ratio.state";
import { RATIO_PRESETS, RatioProcessor } from "./ratio.processor";
import { AspectRatio } from "../../types/editor.types";

export function RatioSelector() {
  const { aspectRatio } = useRatioState();
  const [open, setOpen] = useState(false);

  const currentPreset = RATIO_PRESETS.find((p) => p.id === aspectRatio) || RATIO_PRESETS[0];

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 10px",
          backgroundColor: "#20252c",
          border: "1px solid #333a44",
          borderRadius: "5px",
          color: "#e2e8f0",
          fontSize: "12px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        <span>Ratio:</span>
        <strong style={{ color: "#38bdf8" }}>{currentPreset.id}</strong>
        <span style={{ fontSize: "10px", color: "#8b949e" }}>▼</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              backgroundColor: "#1c2026",
              border: "1px solid #333a44",
              borderRadius: "6px",
              padding: "4px 0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              zIndex: 9999,
              minWidth: "160px",
            }}
          >
            {RATIO_PRESETS.map((p) => {
              const isSelected = p.id === aspectRatio;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    RatioProcessor.setRatio(p.id);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 12px",
                    background: isSelected ? "#262e3d" : "none",
                    border: "none",
                    color: isSelected ? "#38bdf8" : "#cbd5e1",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{p.label}</span>
                  {isSelected && <span style={{ color: "#38bdf8" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
