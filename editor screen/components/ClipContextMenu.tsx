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
import { TransitionModal } from "../plugins/transition";
import { ReplaceModal } from "../plugins/replace";
import { OverlapProcessor } from "../plugins/overlap";
import { CoverProcessor } from "../plugins/cover";
import { useEditorStore } from "../store/editor.store";
import {
  menuItemStyle,
  kbdStyle,
  contextMenuContainerStyle,
} from "./contextMenu.styles";

interface ClipContextMenuProps {
  clip: ClipModel;
  x: number;
  y: number;
  onClose: () => void;
}

export function ClipContextMenu({ clip, x, y, onClose }: ClipContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const currentTime = useEditorStore((state) => state.currentTime);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (!renameOpen && !transOpen && !replaceOpen) onClose();
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, renameOpen, transOpen, replaceOpen]);

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
      <div ref={menuRef} className="clip-context-menu" style={contextMenuContainerStyle(x, y)}>
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

        {clip.type === "video" && (
          <>
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

            {/* Phase 3 Transition */}
            <button
              type="button"
              disabled={clip.locked}
              onClick={() => setTransOpen(true)}
              style={{ ...menuItemStyle(clip.locked), color: "#38bdf8" }}
            >
              <span>{clip.transition ? "Edit Transition (⧖)" : "Add Transition (⋈)"}</span>
            </button>

            {/* Phase 3 Overlap / PIP */}
            <button
              type="button"
              disabled={clip.locked}
              onClick={() => {
                OverlapProcessor.moveToOverlayTrack(clip.id);
                onClose();
              }}
              style={menuItemStyle(clip.locked)}
            >
              <span>Move to Overlay (PIP)</span>
            </button>

            {/* Phase 3 Replace Media */}
            <button
              type="button"
              disabled={clip.locked}
              onClick={() => setReplaceOpen(true)}
              style={menuItemStyle(clip.locked)}
            >
              <span>Replace Media...</span>
            </button>

            {/* Phase 3 Set as Cover */}
            <button
              type="button"
              onClick={() => {
                CoverProcessor.setCoverUrl(clip.mediaUrl || "", clip.id);
                onClose();
              }}
              style={menuItemStyle(false)}
            >
              <span>Set as Project Cover</span>
            </button>
          </>
        )}

        <div style={{ height: "1px", background: "#333a44", margin: "4px 0" }} />

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
          onClick={() => setRenameOpen(true)}
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

      <TransitionModal
        clipId={clip.id}
        isOpen={transOpen}
        currentTransition={clip.transition}
        onClose={() => {
          setTransOpen(false);
          onClose();
        }}
      />

      <ReplaceModal
        clipId={clip.id}
        isOpen={replaceOpen}
        onClose={() => {
          setReplaceOpen(false);
          onClose();
        }}
      />
    </>
  );
}
