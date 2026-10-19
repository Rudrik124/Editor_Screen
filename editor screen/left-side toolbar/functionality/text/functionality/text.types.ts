export type TextAlignment = "left" | "center" | "right";

export interface TextElement {
  id: string;
  content: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  alignment: TextAlignment;
  x: number;
  y: number;
  start: number;
  duration: number;
}
