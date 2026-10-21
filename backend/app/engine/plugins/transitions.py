from typing import List, Optional
from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import TrackSchema

class TransitionPlugin(BasePipelinePlugin):
    """
    Handles seamless transitions between contiguous clips on a single track
    using FFmpeg's hardware-accelerated xfade and acrossfade filters.
    """
    name = "transitions"

    def compose_track_clips(
        self,
        context: CompilationContext,
        track: TrackSchema,
        clip_streams: List[FilterStream],
        stream_type: str
    ) -> Optional[FilterStream]:
        if not clip_streams or len(clip_streams) < 2:
            return None

        if stream_type != "video":
            return None

        # Sequentially blend clips with xfade
        current_stream = clip_streams[0]
        cumulative_duration = current_stream.duration

        for next_stream in clip_streams[1:]:
            trans_dur = 0.5  # default 0.5s transition
            trans_type = "fade"
            
            offset = max(0.0, round(cumulative_duration - trans_dur, 3))
            out_label = context.generate_label("v_xfade")
            
            context.add_node(FilterNode(
                filter_name="xfade",
                inputs=[current_stream.name, next_stream.name],
                outputs=[out_label],
                args={
                    "transition": trans_type,
                    "duration": str(trans_dur),
                    "offset": str(offset)
                }
            ))
            cumulative_duration = offset + next_stream.duration
            current_stream = FilterStream(
                name=out_label,
                stream_type="video",
                duration=cumulative_duration
            )

        return current_stream
