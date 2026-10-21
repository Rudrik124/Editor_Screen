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
        stroke="#e8eaed"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
        <path d="M8.5 4v16M15.5 4v16" />
        <path d="M11 9v6M13 9v6" strokeWidth="2.2" />
      </svg>
    </button>
  );
}
