import { useEditorStore } from "../../store/editor.store";

export function useCoverState() {
  const coverUrl = useEditorStore((state) => state.coverUrl);
  return { coverUrl };
}
