import { EditorIcon } from "./EditorToolIcons";

interface MediaLibraryProps {
  onMediaSelected: (file: File) => void;
  error?: string | null;
}

export function MediaLibrary({ onMediaSelected, error }: MediaLibraryProps) {
  return (
    <aside className="media-library panel">
      <div className="library-tabs"><button className="library-tab active">▣ Media</button><button className="library-tab"><EditorIcon name="audio" size={15} /> Audio</button></div>
      <div className="library-actions"><button className="favorite-button">★ Favorite</button><label className="import-button">＋ Import<input className="media-file-input" type="file" accept="video/*,image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onMediaSelected(file); event.target.value = ""; }} /></label><EditorIcon name="search" /><EditorIcon name="filter" /></div>
      <nav className="library-nav"><div className="nav-item active">★ <span>Favorite</span></div><div className="nav-item">▰ <span>Default</span></div><div className="nav-item">▱ <span>New Library</span></div></nav>
      {error ? <div className="library-empty"><strong>{error}</strong><span>Choose another video or image.</span></div> : <div className="library-empty"><div className="import-symbol"><EditorIcon name="zoomOut" size={34} /></div><strong>Import Stock</strong><span>Drag media here or import from your device</span></div>}
    </aside>
  );
}
