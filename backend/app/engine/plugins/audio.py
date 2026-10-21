from typing import List, Optional
from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema, TrackSchema

class AudioPlugin(BasePipelinePlugin):
    """
    Handles audio clip volume, fade-ins, delays for timeline positioning,
    and multi-channel mixing.
    """
    name = "audio"

    def transform_clip_audio(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        current_label = in_stream.name

        # 1. Volume scaling
        if abs(clip.volume - 1.0) > 0.01:
            out_label = context.generate_label("a_vol")
            context.add_node(FilterNode(
                filter_name="volume",
                inputs=[current_label],
                outputs=[out_label],
                args={"volume": str(round(clip.volume, 2))}
            ))
            current_label = out_label

        # 2. Timeline delay alignment (adelay takes milliseconds)
        if clip.start > 0:
            delay_ms = int(round(clip.start * 1000))
            out_label = context.generate_label("a_delay")
            context.add_node(FilterNode(
                filter_name="adelay",
                inputs=[current_label],
                outputs=[out_label],
                args={"delays": f"{delay_ms}|{delay_ms}"}
            ))
            current_label = out_label

        return FilterStream(
            name=current_label,
            stream_type="audio",
            start_time=clip.start,
            duration=clip.duration
        )

    @staticmethod
    def mix_audio_streams(context: CompilationContext, streams: List[FilterStream]) -> Optional[FilterStream]:
        """Mixes all active audio streams across all tracks into a single master audio track."""
        if not streams:
            return None
        if len(streams) == 1:
            return streams[0]

        out_label = context.generate_label("a_master")
        context.add_node(FilterNode(
            filter_name="amix",
            inputs=[s.name for s in streams],
            outputs=[out_label],
            args={"inputs": str(len(streams)), "dropout_transition": "0"}
        ))
        return FilterStream(name=out_label, stream_type="audio")
