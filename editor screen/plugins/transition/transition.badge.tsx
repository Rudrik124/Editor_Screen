import React, { useState } from "react";
import { ClipModel } from "../../types/editor.types";
import { TransitionModal } from "./transition.ui";

interface TransitionBadgeProps {
  clip: ClipModel;
  timelineDuration: number;
}

export function TransitionBadge({ clip, timelineDuration }: TransitionBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Position at the right edge (end) of the clip
  const endPositionPercent = ((clip.start + clip.duration) / timelineDuration) * 100;

  const hasTransition = Boolean(clip.transition);

  return (
    <>
      <button
        type="button"
        title={hasTransition ? `Transition: ${clip.transition?.type}` : "Add Transition"}
        onClick={(e) => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        style={{
          position: "absolute",
          top: "50%",
          left: `${endPositionPercent}%`,
          transform: "translate(-50%, -50%)",
          width: "18px",
          height: "18px",
          borderRadius: "4px",
          backgroundColor: hasTransition ? "#0284c7" : "#2d343f",
          border: hasTransition ? "1px solid #38bdf8" : "1px solid #475569",
          color: hasTransition ? "#ffffff" : "#94a3b8",
          fontSize: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10,
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          transition: "all 0.15s ease",
          padding: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.0)";
        }}
      >
        {hasTransition ? "⧖" : "⋈"}
      </button>

      <TransitionModal
        clipId={clip.id}
        isOpen={modalOpen}
        currentTransition={clip.transition}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
