import re
from typing import Optional, Dict, Any
from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema

class TextSubtitlePlugin(BasePipelinePlugin):
    """
    Renders text overlays, subtitles, and kinetic typography presets onto video frames using drawtext.
    """
    name = "text_subtitles"

    @staticmethod
    def escape_text(text: str) -> str:
        """Escapes text for FFmpeg drawtext filter parameter."""
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
        content = text_data.get("content") or text_data.get("text") or clip.name or "Sample Text"
        font_size = text_data.get("fontSize", 48)
        font_color = text_data.get("color", "white")
        if isinstance(font_color, str) and font_color.startswith("#") and len(font_color) in (7, 9):
            font_color = "0x" + font_color[1:]
        preset = text_data.get("preset", "none").lower()

        # Target percentage coordinates
        pct_x = float(text_data.get("x", 50))
        pct_y = float(text_data.get("y", 50))

        # Map to FFmpeg expression
        pos_x = f"(w-text_w)*{pct_x / 100.0}"
        pos_y = f"(h-text_h)*{pct_y / 100.0}"

        clean_text = self.escape_text(content)
        out_label = context.generate_label("v_text")
        dur = max(0.1, clip.duration)

        alpha_expr = "1.0"
        # Kinetic animation expressions
        if preset == "fade_in":
            alpha_expr = f"min(1.0,t/0.6)"
        elif preset == "slide_up":
            pos_y = f"(h-text_h)*{pct_y / 100.0} + max(0.0,(1.0-t/0.6)*30)"
            alpha_expr = f"min(1.0,t/0.6)"
        elif preset == "bounce":
            pos_y = f"(h-text_h)*{pct_y / 100.0} - abs(cos(t*10))*exp(-3*t)*25"
            alpha_expr = f"min(1.0,t/0.3)"

        args: Dict[str, str] = {
            "text": f"'{clean_text}'",
            "fontsize": str(font_size),
            "fontcolor": str(font_color),
            "alpha": alpha_expr,
            "x": pos_x,
            "y": pos_y,
            "box": "1",
            "boxcolor": "black@0.4",
            "boxborderw": "8"
        }

        context.add_node(FilterNode(
            filter_name="drawtext",
            inputs=[current_label],
            outputs=[out_label],
            args=args
        ))

        return FilterStream(name=out_label, stream_type="video", duration=in_stream.duration)
