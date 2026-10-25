import { Snowflake } from "@phosphor-icons/react";
import { useFreezeState } from "./freeze.state";
import { FreezeProcessor } from "./freeze.processor";

export function FreezeToolbarButton() {
  const { canFreeze } = useFreezeState();

  const handleFreeze = () => {
    FreezeProcessor.freezeAtCurrentTime(2.0);
  };

  return (
    <button
      type="button"
      className="icon-button"
      title="Freeze Frame at Playhead (2s)"
      aria-label="Freeze Frame"
      disabled={!canFreeze}
      onClick={handleFreeze}
      style={{
        opacity: canFreeze ? 1 : 0.4,
        cursor: canFreeze ? "pointer" : "not-allowed",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Snowflake size={14} weight="regular" />
    </button>
  );
}
