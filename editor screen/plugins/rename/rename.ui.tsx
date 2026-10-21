import { useState } from "react";
import { useRenameState } from "./rename.state";
import { RenameProcessor } from "./rename.processor";

export function RenameModal({
  clipId,
  currentName,
  isOpen,
  onClose,
}: {
  clipId: string;
  currentName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      RenameProcessor.renameClip(clipId, name.trim());
    }
    onClose();
  };

  return (
    <div
      className="rename-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#1e2228",
          padding: "16px 20px",
          borderRadius: "6px",
          border: "1px solid #333a42",
          minWidth: "280px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <label
          htmlFor="rename-clip-input"
          style={{ fontSize: "12px", fontWeight: 600, color: "#e8eaed" }}
        >
          Rename Clip
        </label>
        <input
          id="rename-clip-input"
          type="text"
          value={name}
          maxLength={100}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          style={{
            background: "#14171a",
            border: "1px solid #3c444c",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "5px 12px",
              background: "#282c34",
              border: "1px solid #3c444c",
              color: "#aeb4bc",
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: "5px 12px",
              background: "#20b8a1",
              border: "none",
              color: "#10201e",
              fontWeight: 600,
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export function RenameToolbarButton() {
  const { selectedClip, canRename } = useRenameState();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="icon-button"
        title="Rename Clip"
        aria-label="Rename"
        disabled={!canRename}
        onClick={() => setModalOpen(true)}
        style={{
          opacity: canRename ? 1 : 0.4,
          cursor: canRename ? "pointer" : "not-allowed",
          padding: "4px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      {selectedClip && (
        <RenameModal
          clipId={selectedClip.id}
          currentName={selectedClip.name}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
