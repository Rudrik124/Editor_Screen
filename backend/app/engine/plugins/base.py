from abc import ABC
from typing import Optional, List
from app.engine.models import CompilationContext, FilterStream
from app.schemas.timeline import ClipSchema, TrackSchema

class BasePipelinePlugin(ABC):
    """Abstract base class for all modular FFmpeg pipeline plugins."""

    name: str = "base"

    def transform_clip_video(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        """Applies video transformations for a single clip. Defaults to passthrough."""
        return in_stream

    def transform_clip_audio(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        """Applies audio transformations for a single clip. Defaults to passthrough."""
        return in_stream

    def compose_track_clips(
        self,
        context: CompilationContext,
        track: TrackSchema,
        clip_streams: List[FilterStream],
        stream_type: str
    ) -> Optional[FilterStream]:
        """Composes multiple clips within a track (e.g. crossfades/concat)."""
        return None
