import { EditorIcon } from "./EditorToolIcons";
import { BottomToolbar } from "../bottom tool bar";

export function TimelineToolbar() {
  return (
    <div className="timeline-tools">
      <button className="cover-button" type="button">
        <EditorIcon name="image" /> Cover
      </button>
      <BottomToolbar />
    </div>
  );
}
