import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSpeedState } from "./speed.state";
import { SpeedProcessor } from "./speed.processor";

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0];

export function SpeedToolbarButton() {
  const { currentSpeed, canSetSpeed } = useSpeedState();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, bottom: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !canSetSpeed) return;

    const updateMenuPosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuPosition({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 6,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, canSetSpeed]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        ref={buttonRef}
        className="icon-button"
        title="Playback Speed"
        aria-label="Playback Speed"
        aria-expanded={open}
        disabled={!canSetSpeed}
        onClick={() => setOpen(!open)}
        style={{
          opacity: canSetSpeed ? 1 : 0.4,
          cursor: canSetSpeed ? "pointer" : "not-allowed",
          padding: "4px 6px",
          display: "flex",
          alignItems: "center",
          gap: "2px",
          fontSize: "11px",
          fontWeight: 600,
          color: currentSpeed !== 1.0 ? "#20b8a1" : "inherit",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>{currentSpeed}x</span>
      </button>

      {open && canSetSpeed && createPortal(
        <div
          style={{
            position: "fixed",
            bottom: `${menuPosition.bottom}px`,
            left: `${menuPosition.left}px`,
            background: "#22262d",
            border: "1px solid #3c434d",
            borderRadius: "6px",
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            zIndex: 1000,
            boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
            minWidth: "70px",
          }}
        >
          {SPEED_PRESETS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => {
                SpeedProcessor.setSelectedClipSpeed(speed);
                setOpen(false);
              }}
              style={{
                background: currentSpeed === speed ? "#20b8a1" : "none",
                color: currentSpeed === speed ? "#10201e" : "#dfe3e7",
                border: "none",
                borderRadius: "3px",
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: currentSpeed === speed ? 700 : 400,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {speed}x
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
