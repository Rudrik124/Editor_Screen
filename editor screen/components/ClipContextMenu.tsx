import { useEffect, useRef, useState } from "react";
import { ClipModel } from "../types/editor.types";
import { SplitProcessor } from "../plugins/split";
import { DuplicateProcessor } from "../plugins/duplicate";
import { DeleteProcessor } from "../plugins/delete";
import { LockProcessor } from "../plugins/lock";
import { RenameModal } from "../plugins/rename";
import { TrimProcessor } from "../plugins/trim";
import { ReverseProcessor } from "../plugins/reverse";
import { FreezeProcessor } from "../plugins/freeze";
import { useEditorStore } from "../store/editor.store";

interface ClipContextMenuProps {
  clip: ClipModel;
  x: number;
  y: number;
  onClose: () => void;
}

export function ClipContextMenu({ clip, x, y, onClose }: ClipContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const currentTime = useEditorStore((state) => state.currentTime);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (!renameOpen) onClose();
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, renameOpen]);

  const canTrimLeft =
    !clip.locked &&
    currentTime > clip.start &&
    currentTime < clip.start + clip.duration - 0.1;

  const canTrimRight =
    !clip.locked &&
    currentTime > clip.start + 0.1 &&
    currentTime < clip.start + clip.duration;

  const canFreeze =
    !clip.locked &&
    currentTime > clip.start &&
    currentTime < clip.start + clip.duration;

  return (
    <>
      <div
        ref={menuRef}
        className="clip-context-menu"
        style={{
          position: "fixed",
          top: y,
          left: x,
          background: "#22262d",
          border: "1px solid #3c434d",
          borderRadius: "6px",
          padding: "4px 0",
          zIndex: 9999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          minWidth: "170px",
          fontSize: "12px",
          color: "#dfe3e7",
        }}
      >
        <button
          type="button"
          disabled={clip.locked}
          onClick={() => {
            SplitProcessor.splitAtCurrentTime();
            onClose();
          }}
          style={menuItemStyle(clip.locked)}
        >
          <span>Split at Playhead</span>
          <kbd style={kbdStyle}>S</kbd>
        </button>

        <button
          type="button"
          disabled={!canTrimLeft}
          onClick={() => {
            TrimProcessor.trimClip(clip.id, "left", currentTime);
            onClose();
          }}
          style={menuItemStyle(!canTrimLeft)}
        >
          <span>Trim Start to Playhead</span>
        </button>

        <button
          type="button"
          disabled={!canTrimRight}
          onClick={() => {
            TrimProcessor.trimClip(clip.id, "right", currentTime);
            onClose();
          }}
          style={menuItemStyle(!canTrimRight)}
        >
          <span>Trim End to Playhead</span>
        </button>

        <button
          type="button"
          disabled={clip.locked}
          onClick={() => {
            ReverseProcessor.toggleReverseClip(clip.id);
            onClose();
          }}
          style={menuItemStyle(clip.locked)}
        >
          <span>{clip.reverse ? "Reverse: Off" : "Reverse Video"}</span>
        </button>

        <button
          type="button"
          disabled={!canFreeze}
          onClick={() => {
            FreezeProcessor.freezeClipAt(clip.id, currentTime, 2.0);
            onClose();
          }}
          style={menuItemStyle(!canFreeze)}
        >
          <span>Add Freeze Frame (2s)</span>
        </button>

        <div style={{ height: "1px", background: "#333a44", margin: "4px 0" }} />

        {(() => {
          const state = useEditorStore.getState();
          const track = state.tracks.find(
            (t) => t.id === clip.trackId || t.clipIds.includes(clip.id)
          );
          const clipIndex = track ? track.clipIds.indexOf(clip.id) : -1;
          const nextClipId =
            track && clipIndex >= 0 && clipIndex < track.clipIds.length - 1
              ? track.clipIds[clipIndex + 1]
              : null;
          const nextClip = nextClipId ? state.clips[nextClipId] : null;

          const hasGapAfter =
            nextClip && nextClip.start - (clip.start + clip.duration) > 0.08;

          return (
            <>
              {hasGapAfter && (
                <button
                  type="button"
                  onClick={() => {
                    if (track && nextClip) {
                      const gapStart = clip.start + clip.duration;
                      const gapDuration = nextClip.start - gapStart;
                      useEditorStore.getState().dispatch({
                        id: `close-gap-${Date.now()}`,
                        type: "CLOSE_GAP",
                        payload: {
                          trackId: track.id,
                          gapStart,
                          gapDuration,
                        },
                        timestamp: Date.now(),
                      });
                    }
                    onClose();
                  }}
                  style={{ ...menuItemStyle(false), color: "#20b8a1" }}
                >
                  <span>Close Blank Space</span>
                </button>
              )}

              {nextClip && (
                <button
                  type="button"
                  disabled={clip.locked || nextClip.locked}
                  onClick={() => {
                    useEditorStore.getState().dispatch({
                      id: `merge-${Date.now()}`,
                      type: "MERGE_CLIPS",
                      payload: {
                        firstClipId: clip.id,
                        secondClipId: nextClip.id,
                      },
                      timestamp: Date.now(),
                    });
                    onClose();
                  }}
                  style={{
                    ...menuItemStyle(clip.locked || nextClip.locked),
                    color: clip.locked || nextClip.locked ? undefined : "#4ca9bc",
                  }}
                >
                  <span>Combine with Next Clip</span>
                </button>
              )}
            </>
          );
        })()}

        <button
          type="button"
          onClick={() => {
            DuplicateProcessor.duplicateClip(clip.id);
            onClose();
          }}
          style={menuItemStyle(false)}
        >
          <span>Duplicate</span>
        </button>

        <button
          type="button"
          disabled={clip.locked}
          onClick={() => {
            setRenameOpen(true);
          }}
          style={menuItemStyle(clip.locked)}
        >
          <span>Rename...</span>
        </button>

        <button
          type="button"
          onClick={() => {
            LockProcessor.setClipLock(clip.id, !clip.locked);
            onClose();
          }}
          style={menuItemStyle(false)}
        >
          <span>{clip.locked ? "Unlock Clip" : "Lock Clip"}</span>
        </button>

        <div style={{ height: "1px", background: "#333a44", margin: "4px 0" }} />

        <button
          type="button"
          disabled={clip.locked}
          onClick={() => {
            DeleteProcessor.deleteClip(clip.id);
            onClose();
          }}
          style={{
            ...menuItemStyle(clip.locked),
            color: clip.locked ? "#666" : "#f07178",
          }}
        >
          <span>Delete</span>
          <kbd style={kbdStyle}>Del</kbd>
        </button>
      </div>

      <RenameModal
        clipId={clip.id}
        currentName={clip.name}
        isOpen={renameOpen}
        onClose={() => {
          setRenameOpen(false);
          onClose();
        }}
      />
    </>
  );
}

function menuItemStyle(disabled = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "6px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    color: "inherit",
    fontSize: "12px",
  };
}

const kbdStyle: React.CSSProperties = {
  fontSize: "10px",
  background: "#181b20",
  padding: "2px 5px",
  borderRadius: "3px",
  border: "1px solid #363d47",
  color: "#8e96a0",
};
