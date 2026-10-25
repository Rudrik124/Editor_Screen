import React from "react";
import { Keyboard, X } from "@phosphor-icons/react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "Space", desc: "Play / Pause playback" },
  { key: "S", desc: "Split selected clip at playhead" },
  { key: "Del / Backspace", desc: "Delete selected clip" },
  { key: "Ctrl + Z", desc: "Undo last action" },
  { key: "Ctrl + Shift + Z / Ctrl + Y", desc: "Redo action" },
  { key: "Ctrl + D", desc: "Duplicate selected clip" },
  { key: "L", desc: "Toggle Lock on selected clip" },
  { key: "R", desc: "Reverse selected clip" },
  { key: "F", desc: "Freeze frame at playhead" },
  { key: "T", desc: "Add new text layer" },
  { key: "M", desc: "Mute / Unmute track" },
  { key: "Esc", desc: "Deselect / Close modals" },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "480px",
          maxWidth: "92vw",
          backgroundColor: "#16191f",
          border: "1px solid #2d3441",
          borderRadius: "10px",
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
          color: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #272d38",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Keyboard size={18} color="#38bdf8" />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Keyboard Shortcuts</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", display: "grid", gap: "10px", maxHeight: "65vh", overflowY: "auto" }}>
          {SHORTCUTS.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                backgroundColor: "#1c212a",
                borderRadius: "6px",
                border: "1px solid #262c37",
              }}
            >
              <span style={{ fontSize: "12px", color: "#cbd5e1" }}>{item.desc}</span>
              <kbd
                style={{
                  background: "#0c0e12",
                  border: "1px solid #384252",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "#38bdf8",
                  boxShadow: "0 2px 0 #1e2430",
                }}
              >
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "#121419",
            borderTop: "1px solid #272d38",
            textAlign: "right",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 16px",
              fontSize: "12px",
              backgroundColor: "#222733",
              color: "#e2e8f0",
              border: "1px solid #374151",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
