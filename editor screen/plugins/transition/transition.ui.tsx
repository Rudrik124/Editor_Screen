import { useState } from "react";
import { X } from "@phosphor-icons/react";
import {
  TRANSITION_CATEGORIES,
  VEYTRIX_TRANSITIONS,
  TransitionCategory,
  TransitionDefinition,
} from "./transition.catalog";
import { TransitionData, TransitionType } from "../../types/editor.types";
import { TransitionProcessor } from "./transition.processor";

interface TransitionModalProps {
  clipId: string;
  isOpen: boolean;
  currentTransition?: TransitionData;
  onClose: () => void;
}

export function TransitionModal({
  clipId,
  isOpen,
  currentTransition,
  onClose,
}: TransitionModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<TransitionCategory>("basic");
  const [selectedType, setSelectedType] = useState<TransitionType>(
    currentTransition?.type || "cross_dissolve"
  );
  const [duration, setDuration] = useState<number>(currentTransition?.duration ?? 0.5);
  const [dipColor, setDipColor] = useState<string>(currentTransition?.color || "#000000");

  if (!isOpen) return null;

  const filteredTransitions = VEYTRIX_TRANSITIONS.filter(
    (t) => t.category === selectedCategory
  );

  const handleApply = () => {
    TransitionProcessor.addTransition(clipId, {
      type: selectedType,
      duration,
      color: selectedType === "dip_to_color" ? dipColor : undefined,
    });
    onClose();
  };

  const handleRemove = () => {
    TransitionProcessor.removeTransition(clipId);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(4px)",
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
          width: "560px",
          maxHeight: "85vh",
          backgroundColor: "#1c1f24",
          border: "1px solid #333a44",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
          color: "#e2e6eb",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #2d343f",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 600 }}>Transitions</span>
            <span style={{ fontSize: "12px", color: "#8b949e", background: "#262b33", padding: "2px 6px", borderRadius: "4px" }}>
              20 Available
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#8b949e",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #2d343f",
            backgroundColor: "#16181c",
            overflowX: "auto",
          }}
        >
          {TRANSITION_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: "10px 14px",
                fontSize: "12px",
                fontWeight: selectedCategory === cat.id ? 600 : 400,
                color: selectedCategory === cat.id ? "#38bdf8" : "#8b949e",
                background: "none",
                border: "none",
                borderBottom: selectedCategory === cat.id ? "2px solid #38bdf8" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Transition Grid */}
        <div
          style={{
            padding: "16px 20px",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "10px",
            maxHeight: "340px",
          }}
        >
          {filteredTransitions.map((t) => {
            const isSelected = selectedType === t.id;
            return (
              <div
                key={t.id}
                onClick={() => {
                  setSelectedType(t.id);
                  if (t.defaultDuration && duration === 0.5) {
                    setDuration(t.defaultDuration);
                  }
                }}
                style={{
                  padding: "12px",
                  borderRadius: "6px",
                  backgroundColor: isSelected ? "#1e293b" : "#242931",
                  border: isSelected ? "1.5px solid #38bdf8" : "1px solid #333a44",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: isSelected ? "#38bdf8" : "#f1f5f9" }}>
                    {t.name}
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>#{t.index + 1}</span>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                  {t.purpose}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px", fontStyle: "italic" }}>
                  {t.bestUse}
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls Footer */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #2d343f",
            backgroundColor: "#181b20",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: "12px", color: "#94a3b8" }}>
              Duration: <strong style={{ color: "#f1f5f9" }}>{duration.toFixed(1)}s</strong>
            </label>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              style={{ width: "200px", accentColor: "#38bdf8" }}
            />
          </div>

          {selectedType === "dip_to_color" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: "12px", color: "#94a3b8" }}>Dip Color:</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="color"
                  value={dipColor}
                  onChange={(e) => setDipColor(e.target.value)}
                  style={{ width: "28px", height: "24px", border: "none", cursor: "pointer", background: "none" }}
                />
                <span style={{ fontSize: "11px", color: "#cbd5e1" }}>{dipColor}</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
            {currentTransition ? (
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  padding: "7px 14px",
                  fontSize: "12px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  border: "1px solid #ef4444",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            ) : <div />}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "7px 14px",
                  fontSize: "12px",
                  backgroundColor: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #333a44",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                style={{
                  padding: "7px 18px",
                  fontSize: "12px",
                  fontWeight: 600,
                  backgroundColor: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
