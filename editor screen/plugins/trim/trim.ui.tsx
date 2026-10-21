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
    <div className="trim-buttons" style={{ display: "inline-flex", gap: "2px" }}>
      <button
        type="button"
        className="icon-button"
        title="Trim Start to Playhead"
        aria-label="Trim Start"
        disabled={!canTrimLeft}
        onClick={handleTrimStartAtPlayhead}
        style={{
          opacity: canTrimLeft ? 1 : 0.4,
          cursor: canTrimLeft ? "pointer" : "not-allowed",
          padding: "4px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6v12M9 6l-5 6 5 6M20 6v12" />
        </svg>
      </button>
      <button
        type="button"
        className="icon-button"
        title="Trim End to Playhead"
        aria-label="Trim End"
        disabled={!canTrimRight}
        onClick={handleTrimEndAtPlayhead}
        style={{
          opacity: canTrimRight ? 1 : 0.4,
          cursor: canTrimRight ? "pointer" : "not-allowed",
          padding: "4px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6v12M15 6l5 6-5 6M20 6v12" />
        </svg>
      </button>
    </div>
  );
}
