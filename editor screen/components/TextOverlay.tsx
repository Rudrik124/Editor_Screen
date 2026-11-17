import { useLayoutEffect, useRef, useState } from "react";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";

export function TextOverlay({ element, selected, locked, onSelect, onUpdate, canvasWidth }: {
  element: TextElement; selected: boolean; locked: boolean; canvasWidth: number;
  onSelect: (id: string) => void;
  onUpdate: (id: string, changes: Partial<TextElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0, parentWidth: canvasWidth });
  useLayoutEffect(() => {
    const node = ref.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;
    const measure = () => setBounds({ width: node.offsetWidth, height: node.offsetHeight, parentWidth: parent.clientWidth });
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  const x = position?.x ?? element.x;
  const y = position?.y ?? element.y;
  const finish = (commit: boolean) => {
    if (commit && position) onUpdate(element.id, position);
    drag.current = null;
    setPosition(null);
  };
  return <div ref={ref} className="text-overlay" role="button" tabIndex={0}
    aria-label={`Position text: ${element.content}`} aria-pressed={selected}
    onPointerDown={event => {
      onSelect(element.id);
      if (locked || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x, y, clientX: event.clientX, clientY: event.clientY };
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      const parent = event.currentTarget.parentElement!;
      const availableX = parent.clientWidth - event.currentTarget.offsetWidth;
      const availableY = parent.clientHeight - event.currentTarget.offsetHeight;
      setPosition({
        x: Math.max(0, Math.min(100, drag.current.x + (event.clientX - drag.current.clientX) / Math.max(1, availableX) * 100)),
        y: Math.max(0, Math.min(100, drag.current.y + (event.clientY - drag.current.clientY) / Math.max(1, availableY) * 100)),
      });
    }}
    onPointerUp={event => { finish(true); event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={() => finish(false)} onLostPointerCapture={() => finish(false)}
    onKeyDown={event => {
      if (event.key === "Escape") { finish(false); return; }
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!delta || locked) return;
      event.preventDefault(); event.stopPropagation();
      const step = event.shiftKey ? 5 : 1;
      onUpdate(element.id, { x: Math.max(0, Math.min(100, x + delta[0] * step)), y: Math.max(0, Math.min(100, y + delta[1] * step)) });
    }}
    style={{ position: "absolute", left: `calc(${x}% - ${bounds.width * x / 100}px)`, top: `calc(${y}% - ${bounds.height * y / 100}px)`,
      cursor: locked ? "default" : "move", touchAction: "none", userSelect: "none", whiteSpace: "pre-wrap", maxWidth: "100%",
      color: element.color, fontSize: element.fontSize * bounds.parentWidth / canvasWidth,
      fontWeight: element.bold ? 700 : 400, fontStyle: element.italic ? "italic" : "normal", fontFamily: "Arial, sans-serif",
      lineHeight: 1.2, textAlign: element.alignment, outline: selected ? "1px solid #20b8a1" : undefined,
      textShadow: element.neon ? `0 0 4px white, 0 0 12px ${element.color}, 0 0 24px ${element.color}` : undefined,
    }}>{element.content}</div>;
}
