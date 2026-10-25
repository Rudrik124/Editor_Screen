import React from "react";
import { Camera, X } from "@phosphor-icons/react";
import { useCoverState } from "./cover.state";
import { CoverProcessor } from "./cover.processor";

interface CoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  clipId?: string;
}

export function CoverModal({ isOpen, onClose, canvasRef, clipId }: CoverModalProps) {
  const { coverUrl } = useCoverState();

  if (!isOpen) return null;

  const handleCapture = () => {
    if (canvasRef?.current) {
      CoverProcessor.setCoverFromCanvas(canvasRef.current, clipId);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
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
          width: "420px",
          backgroundColor: "#1c2026",
          border: "1px solid #333a44",
          borderRadius: "8px",
          padding: "18px",
          color: "#e2e8f0",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontSize: "15px", fontWeight: 600 }}>Project Cover / Thumbnail</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            backgroundColor: "#0d1117",
            borderRadius: "6px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #2d343f",
            marginBottom: "14px",
          }}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="Cover preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <span style={{ color: "#64748b", fontSize: "12px" }}>No cover frame set yet</span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleCapture}
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              backgroundColor: "#2d343f",
              color: "#38bdf8",
              border: "1px solid #3b4250",
              borderRadius: "5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Camera size={14} weight="regular" />
            <span>Capture Current Frame</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 18px",
              fontSize: "12px",
              backgroundColor: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
