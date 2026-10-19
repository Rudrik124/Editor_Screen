import "./TextIcon.css";
export function TextIcon({ active = false, onClick }: { active?: boolean; onClick?: () => void }){return <button className={active ? "active" : ""} aria-label="Text tool" aria-pressed={active} onClick={onClick}><svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14M12 5v14M8 19h8"/></svg></button>}
