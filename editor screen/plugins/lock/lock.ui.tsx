import { useLockState } from "./lock.state";
import { LockProcessor } from "./lock.processor";

export function LockToolbarButton() {
  const { isLocked, canToggleLock } = useLockState();

  return (
    <button
      type="button"
      className="icon-button"
      title={isLocked ? "Unlock Clip" : "Lock Clip"}
      aria-label={isLocked ? "Unlock" : "Lock"}
      disabled={!canToggleLock}
      onClick={() => LockProcessor.toggleLockSelectedClip()}
      style={{
        opacity: canToggleLock ? 1 : 0.4,
        cursor: canToggleLock ? "pointer" : "not-allowed",
        padding: "4px 6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: isLocked ? "#f2c94c" : "inherit",
      }}
    >
      {isLocked ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      )}
    </button>
  );
}
