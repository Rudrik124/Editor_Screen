import React, { useMemo } from "react";
import { Wind, Trash, Play, Check } from "@phosphor-icons/react";
import { useEditorStore } from "../../store/editor.store";
import { commandBus } from "../../store/command.bus";
import { EFFECT_CATALOG } from "./effects.catalog";
import { resolveActiveClips } from "../../components/utils/previewResolver";
import "../filters/filters.ui.css";

export function EffectsPanel({ clipId }: { clipId?: string }) {
  const storeTracks = useEditorStore((state) => state.tracks);
  const storeClips = useEditorStore((state) => state.clips);
  const storeCurrentTime = useEditorStore((state) => state.currentTime);
  const storeSelectedClipId = useEditorStore((state) => state.selectedClipId);

  const activeClipUnderPlayhead = useMemo(() => {
    return resolveActiveClips(storeTracks, storeClips, storeCurrentTime).activeVideoClip;
  }, [storeTracks, storeClips, storeCurrentTime]);

  const targetClipId = clipId || storeSelectedClipId || activeClipUnderPlayhead?.id || null;
  const clip = targetClipId ? storeClips[targetClipId] : null;

  const activeEffect = clip?.effects?.[0];

  const handleApplyEffect = (effId: string) => {
    if (!targetClipId) return;
    if (storeSelectedClipId !== targetClipId) {
      useEditorStore.getState().selectClip(targetClipId);
    }
    const def = EFFECT_CATALOG.find((e) => e.id === effId);
    commandBus.createAndDispatch("SET_EFFECTS", {
      clipId: targetClipId,
      effects: [{ type: effId, parameters: { ...(def?.defaultParams || {}) } }],
    });
  };

  const handleRemoveEffect = () => {
    if (!targetClipId) return;
    commandBus.createAndDispatch("SET_EFFECTS", {
      clipId: targetClipId,
      effects: [],
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
        <Wind size={20} style={{ opacity: 0.4, margin: "0 auto 8px", display: "block" }} />
        Select a clip on the timeline to apply motion and animation effects.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Active Effect Banner */}
      {activeEffect && (
        <div
          style={{
            background: "rgba(6, 182, 212, 0.06)",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(6, 182, 212, 0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Wind size={15} color="var(--accent-primary, #06b6d4)" />
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-primary, #06b6d4)" }}>
                {EFFECT_CATALOG.find((e) => e.id === activeEffect.type)?.name || activeEffect.type}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted, #94a3b8)" }}>
                Active Motion Transform
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveEffect}
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
      )}

      {/* Effects Grid */}
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
        {EFFECT_CATALOG.map((eff) => {
          const isSelected = activeEffect?.type === eff.id;
          return (
            <button
              key={eff.id}
              type="button"
              className={`filter-card ${isSelected ? "selected" : ""}`}
              onClick={() => handleApplyEffect(eff.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "4px" }}>
                <span className="filter-card-title">{eff.name}</span>
                {isSelected ? (
                  <Check size={12} weight="bold" color="var(--accent-primary, #06b6d4)" />
                ) : (
                  <Play size={10} style={{ opacity: 0.4 }} />
                )}
              </div>
              <span className="filter-card-desc">{eff.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
