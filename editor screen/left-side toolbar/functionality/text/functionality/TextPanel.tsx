import { TextElement } from "./text.types";
import "./TextPanel.css";

interface TextPanelProps {
  elements: TextElement[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function TextPanel({ elements, selectedId, onSelect, onAdd }: TextPanelProps) {
  return (
    <section className="text-tool-panel" aria-label="Text tool">
      <div className="text-tool-header"><strong>Text</strong><button type="button" onClick={onAdd}>＋ Add text</button></div>
      <div className="text-element-list">
        {elements.length === 0 ? <span className="text-tool-empty">Add a text element to begin.</span> : elements.map((element) => (
          <button type="button" className={element.id === selectedId ? "text-element selected" : "text-element"} key={element.id} onClick={() => onSelect(element.id)}>
            <span>{element.content || "Untitled text"}</span><small>{element.duration.toFixed(2)}s</small>
          </button>
        ))}
      </div>
    </section>
  );
}
