import re
from typing import Optional
from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema

class TextSubtitlePlugin(BasePipelinePlugin):
    """
    Renders text overlays and subtitles directly onto video frames using drawtext.
    """
    name = "text_subtitles"

    @staticmethod
    def escape_text(text: str) -> str:
        """Escapes text for FFmpeg drawtext filter parameter."""
        # Replace apostrophe, colon, backslash, percent
        text = text.replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:").replace("%", "\\%")
        return text

    def transform_clip_video(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        if clip.type != "text" and not clip.textData:
            return in_stream

        current_label = in_stream.name
        text_data = clip.textData or {}
        content = text_data.get("content") or clip.name or "Sample Text"
        font_size = text_data.get("fontSize", 48)
        font_color = text_data.get("color", "white")
        pos_x = text_data.get("x", "(w-text_w)/2")
        pos_y = text_data.get("y", "(h-text_h)/2")

        clean_text = self.escape_text(content)
        out_label = context.generate_label("v_text")

        context.add_node(FilterNode(
            filter_name="drawtext",
            inputs=[current_label],
            outputs=[out_label],
            args={
                "text": f"'{clean_text}'",
                "fontsize": str(font_size),
                "fontcolor": str(font_color),
                "x": str(pos_x),
                "y": str(pos_y),
                "box": "1",
                "boxcolor": "black@0.4",
                "boxborderw": "8"
            }
        ))

        return FilterStream(name=out_label, stream_type="video", duration=in_stream.duration)
