import { useState } from "react";
import { TextElement } from "./text.types";

const createTextElement = (): TextElement => ({
  id: `text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  content: "Text",
  fontSize: 32,
  color: "#ffffff",
  bold: false,
  italic: false,
  alignment: "center",
  x: 50,
  y: 50,
  start: 0,
  duration: 3,
});

export function useTextElements() {
  const [elements, setElements] = useState<TextElement[]>([]);
  const [selectedId, setSelectedId] = useState<string>();

  const add = () => {
    const element = createTextElement();
    setElements((current) => [...current, element]);
    setSelectedId(element.id);
  };

  const update = (id: string, changes: Partial<TextElement>) => {
    setElements((current) => current.map((element) => element.id === id ? { ...element, ...changes } : element));
  };

  const remove = (id: string) => {
    setElements((current) => current.filter((element) => element.id !== id));
    setSelectedId((current) => current === id ? undefined : current);
  };

  return { elements, selectedId, setSelectedId, add, update, remove };
}
