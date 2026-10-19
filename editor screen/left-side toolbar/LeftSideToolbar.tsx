import { MusicIcon } from "./functionality/music/functionality";
import { TextIcon } from "./functionality/text/functionality";
import { VideoIcon } from "./functionality/Overlay/functionality";
import { AudioIcon } from "./functionality/Video/functionality";
import { MusicSecondaryIcon } from "./functionality/Audio/functionality";
import "./left-side-toolbar.css";

export function LeftSideToolbar({ onAddText }: { onAddText: () => void }) {
  return (
    <><aside className="veytrix-left-side-toolbar" aria-label="Timeline track tools">
      <MusicIcon />
      <TextIcon onClick={onAddText} />
      <VideoIcon />
      <AudioIcon />
      <MusicSecondaryIcon />
    </aside></>
  );
}
