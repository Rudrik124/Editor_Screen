import { MusicIcon } from "./functionality/music/functionality";
import { TextIcon } from "./functionality/text/functionality";
import { VideoIcon } from "./functionality/Overlay/functionality";
import { AudioIcon } from "./functionality/Video/functionality";
import { MusicSecondaryIcon } from "./functionality/Audio/functionality";
import { VideoThumbnail } from "./functionality/Video/functionality";
import "./left-side-toolbar.css";

interface LeftSideToolbarProps {
  media: { url: string; name: string } | null;
}

export function LeftSideToolbar({ media }: LeftSideToolbarProps) {
  return (
    <aside className="veytrix-left-side-toolbar" aria-label="Timeline track tools">
      <MusicIcon />
      <TextIcon />
      <VideoIcon />
      <VideoThumbnail media={media} />
      <AudioIcon />
      <MusicSecondaryIcon />
    </aside>
  );
}
