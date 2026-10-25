import { ArrowsClockwise } from "@phosphor-icons/react";
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
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: isReversed ? "#20b8a1" : "inherit",
      }}
    >
      <ArrowsClockwise size={14} weight="regular" />
    </button>
  );
}
