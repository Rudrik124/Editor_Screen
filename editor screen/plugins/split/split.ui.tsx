import { useSplitState } from "./split.state";
import { SplitProcessor } from "./split.processor";

export function SplitToolbarButton() {
  const { canSplit } = useSplitState();

  return (
    <button
      type="button"
      className="icon-button"
      title="Split at Playhead (S)"
      aria-label="Split"
      disabled={!canSplit}
      onClick={() => SplitProcessor.splitAtCurrentTime()}
      style={{
        opacity: canSplit ? 1 : 0.4,
        cursor: canSplit ? "pointer" : "not-allowed",
        padding: "4px 6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3.5" y="4" width="17" height="16" rx="4" />
        <path d="m10 9-3 3 3 3M14 9l3 3-3 3M12 8v8" />
      </svg>
    </button>
  );
}
