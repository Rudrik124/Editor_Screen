import { useEffect, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);
    }
  }, [currentName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a clip name.");
      return;
    }

    const renamed = RenameProcessor.renameClip(clipId, trimmedName);
    if (!renamed) {
      setError("Unable to rename this clip.");
      return;
    }

    onClose();
  };

  return (
    <div
      className="rename-modal-overlay"
      data-toolbar-modal="true"
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
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "rename-clip-error" : undefined}
          style={{
            background: "#14171a",
            border: `1px solid ${error ? "#f87171" : "#3c444c"}`,
            color: "#fff",
            padding: "6px 8px",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        />
        {error && (
          <span
            id="rename-clip-error"
            role="alert"
            style={{ color: "#f87171", fontSize: "11px" }}
          >
            {error}
          </span>
        )}
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
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PencilSimple size={14} weight="regular" />
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
