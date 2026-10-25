import { Scissors } from "@phosphor-icons/react";
import { useSplitState } from "./split.state";
import { SplitProcessor } from "./split.processor";

export function SplitToolbarButton() {
  const { canSplit } = useSplitState();

  return (
    <button
      type="button"
      className="icon-button"
      title="Split at Playhead (Hotkey: S)"
      aria-label="Split"
      disabled={!canSplit}
      onClick={() => SplitProcessor.splitAtCurrentTime()}
      style={{
        opacity: canSplit ? 1 : 0.4,
        cursor: canSplit ? "pointer" : "not-allowed",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Scissors size={15} weight="regular" />
    </button>
  );
}
