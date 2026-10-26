import React, { useState } from "react";
import { ClipModel } from "../../types/editor.types";
import { TransitionModal } from "./transition.ui";
import { useEditorStore } from "../../store/editor.store";

interface TransitionBadgeProps {
  clip: ClipModel;
  timelineDuration: number;
}

export function TransitionBadge({ clip, timelineDuration }: TransitionBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const tracks = useEditorStore((state) => state.tracks);
  const clips = useEditorStore((state) => state.clips);

  const track = tracks.find((t) => t.id === clip.trackId || t.clipIds.includes(clip.id));
  const clipIndex = track ? track.clipIds.indexOf(clip.id) : -1;
  const isLastClip = track ? clipIndex === track.clipIds.length - 1 : false;

  const nextClipId = track && clipIndex >= 0 && clipIndex < track.clipIds.length - 1 ? track.clipIds[clipIndex + 1] : null;
  const nextClip = nextClipId ? clips[nextClipId] : null;

  const currentTransition = clip.transition || nextClip?.transition;
  const hasTransition = Boolean(currentTransition);

  // If this clip is the last clip on the track with no subsequent clip to transition into, hide badge
  if (isLastClip && !hasTransition) {
    return null;
  }

  // Position at the right edge (end) of the clip
  const endPositionPercent = ((clip.start + clip.duration) / timelineDuration) * 100;

  return (
    <>
      <button
        type="button"
        title={hasTransition ? `Transition: ${currentTransition?.type}` : "Add Transition"}
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
        currentTransition={currentTransition}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
