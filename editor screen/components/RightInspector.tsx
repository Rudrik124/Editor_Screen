import { EditorIcon } from "./EditorToolIcons";
import { IconName } from "../types/editor.types";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";

const inspectorTools: [IconName, string][] = [["effects", "Effects"], ["speed", "Speed"], ["volume", "Volume"], ["mask", "Mask"], ["transform", "Transform"], ["filter", "Filters"]];

export function RightInspector({ selectedText, onUpdateText, onDeleteText }: { selectedText?: TextElement; onUpdateText: (id: string, changes: Partial<TextElement>) => void; onDeleteText: (id: string) => void }) {
  return <aside className="right-side"><div className="vertical-tools">{inspectorTools.map(([icon, label]) => <button key={label} aria-label={label}><EditorIcon name={icon} /></button>)}</div><div className="inspector panel">{selectedText ? <div className="text-edit-inspector"><h2>Edit</h2><label>Text</label><div className="text-edit-box"><textarea placeholder="Input Title" value={selectedText.content} onChange={(event) => onUpdateText(selectedText.id, { content: event.target.value })} /><div className="text-edit-actions"><button type="button" aria-label="Expand text editor">⌜</button><button type="button" aria-label="Delete text" onClick={() => onDeleteText(selectedText.id)}>♜</button></div></div></div> : <div className="select-empty"><EditorIcon name="grid" size={34} /><span>Select to Edit</span></div>}</div></aside>;
}
