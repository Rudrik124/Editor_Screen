import { ArrowLineLeft, ArrowLineRight } from "@phosphor-icons/react";
import { useTrimState } from "./trim.state";
import { TrimProcessor } from "./trim.processor";
import { useEditorStore } from "../../store/editor.store";

export function TrimToolbarButton() {
  const { selectedClip, canTrim } = useTrimState();
  const currentTime = useEditorStore((state) => state.currentTime);

  const handleTrimStartAtPlayhead = () => {
    if (!selectedClip) return;
    TrimProcessor.trimSelectedClip("left", currentTime);
  };

  const handleTrimEndAtPlayhead = () => {
    if (!selectedClip) return;
    TrimProcessor.trimSelectedClip("right", currentTime);
  };

  const canTrimLeft =
    canTrim &&
    selectedClip &&
    currentTime > selectedClip.start &&
    currentTime < selectedClip.start + selectedClip.duration - 0.1;

  const canTrimRight =
    canTrim &&
    selectedClip &&
    currentTime > selectedClip.start + 0.1 &&
    currentTime < selectedClip.start + selectedClip.duration;

  return (
    <div className="trim-buttons" style={{ display: "inline-flex", gap: "2px", alignItems: "center" }}>
      <button
        type="button"
        className="icon-button"
        title="Trim Left Edge to Playhead"
        aria-label="Trim Left"
        disabled={!canTrimLeft}
        onClick={handleTrimStartAtPlayhead}
        style={{
          opacity: canTrimLeft ? 1 : 0.4,
          cursor: canTrimLeft ? "pointer" : "not-allowed",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ArrowLineLeft size={14} weight="bold" />
      </button>
      <button
        type="button"
        className="icon-button"
        title="Trim Right Edge to Playhead"
        aria-label="Trim Right"
        disabled={!canTrimRight}
        onClick={handleTrimEndAtPlayhead}
        style={{
          opacity: canTrimRight ? 1 : 0.4,
          cursor: canTrimRight ? "pointer" : "not-allowed",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ArrowLineRight size={14} weight="bold" />
      </button>
    </div>
  );
}
