import React from "react";

export function menuItemStyle(disabled = false): React.CSSProperties {
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

export const kbdStyle: React.CSSProperties = {
  fontSize: "10px",
  background: "#181b20",
  padding: "2px 5px",
  borderRadius: "3px",
  border: "1px solid #363d47",
  color: "#8e96a0",
};

export const contextMenuContainerStyle = (x: number, y: number): React.CSSProperties => ({
  position: "fixed",
  top: y,
  left: x,
  background: "#22262d",
  border: "1px solid #3c434d",
  borderRadius: "6px",
  padding: "4px 0",
  zIndex: 9999,
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  minWidth: "175px",
  fontSize: "12px",
  color: "#dfe3e7",
});
