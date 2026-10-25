import React, { useState } from "react";
import { EditorIcon } from "./EditorToolIcons";
import { IconName } from "../types/editor.types";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";
import { useEditorStore } from "../store/editor.store";
import { OverlapInspector } from "../plugins/overlap";
import { KeyframeInspector } from "../plugins/keyframe";

const inspectorTools: [IconName, string][] = [
  ["transform", "Transform"],
  ["speed", "Keyframes"],
  ["volume", "Volume"],
  ["effects", "Effects"],
  ["filter", "Filters"],
];

interface RightInspectorProps {
  selectedText?: TextElement;
  onUpdateText: (id: string, changes: Partial<TextElement>) => void;
  onDeleteText: (id: string) => void;
}

export function RightInspector({
  selectedText,
  onUpdateText,
  onDeleteText,
}: RightInspectorProps) {
  const [activeTab, setActiveTab] = useState<string>("Transform");
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClip = useEditorStore((state) =>
    selectedClipId ? state.clips[selectedClipId] : null
  );

  return (
    <aside className="right-side">
      <div className="vertical-tools">
        {inspectorTools.map(([icon, label]) => (
          <button
            key={label}
            aria-label={label}
            className={activeTab === label ? "active" : ""}
            onClick={() => setActiveTab(label)}
          >
            <EditorIcon name={icon} />
          </button>
        ))}
      </div>

      <div className="inspector panel">
        {selectedText ? (
          <div className="text-edit-inspector">
            <h2>Edit Text</h2>
            <label>Text</label>
            <div className="text-edit-box">
              <textarea
                placeholder="Input Title"
                value={selectedText.content}
                onChange={(event) =>
                  onUpdateText(selectedText.id, { content: event.target.value })
                }
              />
              <div className="text-edit-actions">
                <button type="button" aria-label="Expand text editor">⌜</button>
                <button type="button" aria-label="Delete text" onClick={() => onDeleteText(selectedText.id)}>♜</button>
              </div>
            </div>
          </div>
        ) : selectedClip ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #2d343f" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>
                {selectedClip.name || "Selected Clip"}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                Type: {selectedClip.type} | Duration: {selectedClip.duration.toFixed(2)}s
              </div>
            </div>

            {activeTab === "Transform" ? (
              <OverlapInspector clipId={selectedClip.id} />
            ) : activeTab === "Keyframes" ? (
              <KeyframeInspector clipId={selectedClip.id} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <OverlapInspector clipId={selectedClip.id} />
                <KeyframeInspector clipId={selectedClip.id} />
              </div>
            )}
          </div>
        ) : (
          <div className="select-empty">
            <EditorIcon name="grid" size={34} />
            <span>Select a clip or text to edit</span>
          </div>
        )}
      </div>
    </aside>
  );
}
