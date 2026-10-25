import React, { useRef } from "react";
import { ReplaceProcessor } from "./replace.processor";

interface ReplaceModalProps {
  clipId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReplaceModal({ clipId, isOpen, onClose }: ReplaceModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await ReplaceProcessor.replaceWithFile(clipId, file);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
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
          width: "360px",
          backgroundColor: "#1c2026",
          border: "1px solid #333a44",
          borderRadius: "8px",
          padding: "20px",
          color: "#e2e8f0",
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Replace Media</h3>
        <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "16px" }}>
          Select a new video or image. Timing, keyframes, transitions, and transforms will be preserved.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
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
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "7px 16px",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Choose File...
          </button>
        </div>
      </div>
    </div>
  );
}
