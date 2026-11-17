import { ArrowLineLeft, ArrowLineRight } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useTrimState } from "./trim.state";
import { TrimProcessor } from "./trim.processor";
import { useEditorStore } from "../../store/editor.store";

export function TrimToolbarButton() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const { selectedClip, canTrim } = useTrimState();
  const currentTime = useEditorStore((state) => state.currentTime);

  const handleTrimStartAtPlayhead = () => {
    if (!selectedClip) return;
    TrimProcessor.trimSelectedClip("left", currentTime);
    setOpen(false);
  };

  const handleTrimEndAtPlayhead = () => {
    if (!selectedClip) return;
    TrimProcessor.trimSelectedClip("right", currentTime);
    setOpen(false);
  };

  const canTrimLeft =
    canTrim &&
    selectedClip &&
    currentTime > selectedClip.start &&
    currentTime < selectedClip.start + selectedClip.duration - 0.1;

  const canTrimRight =
    canTrim &&
    selectedClip &&
    currentTime > selectedClip.start + 0.1 &&
    currentTime < selectedClip.start + selectedClip.duration;

  return (
    <div ref={container} className="trim-buttons" style={{ position: "relative" }}
      onKeyDown={event => { if (event.key === "Escape") { setOpen(false); container.current?.querySelector<HTMLButtonElement>("button")?.focus(); } }}>
      <button type="button" className="icon-button" aria-label="Trim options" aria-expanded={open}
        disabled={!canTrim} onClick={() => setOpen(value => !value)}><ArrowLineLeft size={14} /><ArrowLineRight size={14} /></button>
      {open && <div data-toolbar-modal style={{ position: "absolute", bottom: "100%", left: 0, zIndex: 50, background: "#20252b", padding: 8, minWidth: 150, display: "grid", gap: 8 }}>
        <button type="button" disabled={!canTrimLeft} onClick={handleTrimStartAtPlayhead} title="Remove the selected clip before the playhead">Trim Left</button>
        <button type="button" disabled={!canTrimRight} onClick={handleTrimEndAtPlayhead} title="Remove the selected clip after the playhead">Trim Right</button>
      </div>}
    </div>
  );
}
