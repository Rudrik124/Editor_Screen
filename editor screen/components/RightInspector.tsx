import { EditorIcon } from "./EditorToolIcons";
import { IconName } from "../types/editor.types";

const inspectorTools: [IconName, string][] = [["effects", "Effects"], ["speed", "Speed"], ["volume", "Volume"], ["mask", "Mask"], ["transform", "Transform"], ["filter", "Filters"]];

export function RightInspector() {
  return <aside className="right-side"><div className="vertical-tools">{inspectorTools.map(([icon, label]) => <button key={label} aria-label={label}><EditorIcon name={icon} /></button>)}</div><div className="inspector panel"><div className="select-empty"><EditorIcon name="grid" size={34} /><span>Select to Edit</span></div></div></aside>;
}
