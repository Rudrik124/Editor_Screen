import { LockSimple, LockSimpleOpen } from "@phosphor-icons/react";
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
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: isLocked ? "#f2c94c" : "inherit",
      }}
    >
      {isLocked ? (
        <LockSimple size={14} weight="bold" />
      ) : (
        <LockSimpleOpen size={14} weight="regular" />
      )}
    </button>
  );
}
