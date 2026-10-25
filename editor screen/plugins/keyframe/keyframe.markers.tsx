import React from "react";
import { KeyframeData } from "../../types/editor.types";

interface KeyframeMarkersProps {
  keyframes?: KeyframeData[];
  clipDuration: number;
}

export function KeyframeMarkers({ keyframes, clipDuration }: KeyframeMarkersProps) {
  if (!keyframes || keyframes.length === 0 || clipDuration <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      {keyframes.map((k) => {
        const leftPercent = Math.max(0, Math.min(100, (k.timeOffset / clipDuration) * 100));
        return (
          <span
            key={k.id}
            title={`${k.property}: ${k.value} at ${k.timeOffset.toFixed(2)}s`}
            style={{
              position: "absolute",
              left: `${leftPercent}%`,
              top: "2px",
              transform: "translateX(-50%)",
              fontSize: "9px",
              color: "#38bdf8",
              lineHeight: 1,
              textShadow: "0 0 2px rgba(0,0,0,0.8)",
            }}
          >
            ◆
          </span>
        );
      })}
    </div>
  );
}
