import { useEditorStore } from "../../store/editor.store";

export function useRatioState() {
  const aspectRatio = useEditorStore((state) => state.aspectRatio);
  return { aspectRatio };
}
