import { useReverseState } from "./reverse.state";
import { ReverseProcessor } from "./reverse.processor";

export function ReverseToolbarButton() {
  const { isReversed, canReverse } = useReverseState();

  return (
    <button
      type="button"
      className="icon-button"
      title={isReversed ? "Reverse: On (Click to normal)" : "Reverse Video"}
      aria-label="Reverse"
      disabled={!canReverse}
      onClick={() => ReverseProcessor.toggleReverseSelectedClip()}
      style={{
        opacity: canReverse ? 1 : 0.4,
        cursor: canReverse ? "pointer" : "not-allowed",
        padding: "4px 6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: isReversed ? "#20b8a1" : "inherit",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 19l-9-7 9-7v14z" />
        <path d="M22 19l-9-7 9-7v14z" />
      </svg>
    </button>
  );
}
