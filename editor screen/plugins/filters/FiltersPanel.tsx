import React, { useState } from "react";
import { SlidersHorizontal, Trash, Sparkle, Check } from "@phosphor-icons/react";
import { useEditorStore } from "../../store/editor.store";
import { commandBus } from "../../store/command.bus";
import { FILTER_CATALOG } from "./filters.catalog";
import "./filters.ui.css";

const CATEGORY_COLORS: Record<string, string> = {
  Cinematic: "linear-gradient(90deg, #f59e0b, #06b6d4)",
  "Lighting & Tone": "linear-gradient(90deg, #fbbf24, #f43f5e)",
  Portrait: "linear-gradient(90deg, #ec4899, #f472b6)",
  "Vintage & Retro": "linear-gradient(90deg, #a16207, #78716c)",
  "Black & White": "linear-gradient(90deg, #1e293b, #cbd5e1)",
  "Nature & Landscape": "linear-gradient(90deg, #10b981, #0284c7)",
  "Neon & Cyber": "linear-gradient(90deg, #8b5cf6, #06b6d4)",
  "Creative & Artistic": "linear-gradient(90deg, #6366f1, #d946ef)",
};

export function FiltersPanel({ clipId }: { clipId?: string }) {
  const selectedClipId = useEditorStore((state) => clipId || state.selectedClipId);
  const clip = useEditorStore((state) => (selectedClipId ? state.clips[selectedClipId] : null));

  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(FILTER_CATALOG.map((f) => f.category)))];
  const displayedFilters =
    selectedCategory === "All"
      ? FILTER_CATALOG
      : FILTER_CATALOG.filter((f) => f.category === selectedCategory);

  const activeFilter = clip?.filters?.[0];
  const activeIntensity = activeFilter?.intensity ?? 1.0;

  const handleApplyFilter = (filterId: string) => {
    if (!selectedClipId) return;
    commandBus.createAndDispatch("SET_FILTERS", {
      clipId: selectedClipId,
      filters: [{ type: filterId, intensity: activeIntensity }],
    });
  };

  const handleIntensityChange = (val: number) => {
    if (!selectedClipId || !activeFilter) return;
    commandBus.createAndDispatch("SET_FILTERS", {
      clipId: selectedClipId,
      filters: [{ type: activeFilter.type, intensity: val }],
    });
  };

  const handleRemoveFilter = () => {
    if (!selectedClipId) return;
    commandBus.createAndDispatch("SET_FILTERS", {
      clipId: selectedClipId,
      filters: [],
    });
  };

  if (!clip) {
    return (
      <div
        style={{
          padding: "24px 16px",
          color: "var(--text-muted, #94a3b8)",
          fontSize: "12px",
          textAlign: "center",
          background: "rgba(255, 255, 255, 0.02)",
          borderRadius: "8px",
          border: "1px dashed rgba(255, 255, 255, 0.08)",
          margin: "12px 0",
        }}
      >
        <Sparkle size={20} style={{ opacity: 0.4, margin: "0 auto 8px", display: "block" }} />
        Select a video or image clip on the timeline to apply color filters.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Category Filter Pills */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          overflowX: "auto",
          paddingBottom: "4px",
          scrollbarWidth: "none",
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`filter-category-chip ${selectedCategory === cat ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Active Filter Control Bar */}
      {activeFilter && (
        <div
          style={{
            background: "rgba(6, 182, 212, 0.06)",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(6, 182, 212, 0.25)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-primary, #06b6d4)" }}>
                {FILTER_CATALOG.find((f) => f.id === activeFilter.type)?.name || activeFilter.type}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  background: "rgba(6, 182, 212, 0.2)",
                  color: "#06b6d4",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Active
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveFilter}
              style={{
                background: "transparent",
                border: "none",
                color: "#f87171",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: 500,
              }}
            >
              <Trash size={13} />
              <span>Reset</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SlidersHorizontal size={14} style={{ opacity: 0.6 }} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={activeIntensity}
              onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
              style={{
                flex: 1,
                accentColor: "var(--accent-primary, #06b6d4)",
                cursor: "pointer",
                height: "4px",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-primary, #fff)",
                minWidth: "34px",
                textAlign: "right",
              }}
            >
              {Math.round(activeIntensity * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Filter Presets Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "8px",
          maxHeight: "360px",
          overflowY: "auto",
          paddingRight: "2px",
        }}
      >
        {displayedFilters.map((f) => {
          const isSelected = activeFilter?.type === f.id;
          const stripGrad = CATEGORY_COLORS[f.category] || "var(--accent-primary, #06b6d4)";
          return (
            <button
              key={f.id}
              type="button"
              className={`filter-card ${isSelected ? "selected" : ""}`}
              onClick={() => handleApplyFilter(f.id)}
            >
              <div
                className="filter-card-preview-strip"
                style={{ background: stripGrad }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <span className="filter-card-title">{f.name}</span>
                {isSelected && <Check size={12} weight="bold" color="var(--accent-primary, #06b6d4)" />}
              </div>
              <span className="filter-card-desc">{f.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
