from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema

class EffectsPlugin(BasePipelinePlugin):
    """
    Applies motion transforms, blur effects, and visual styling.
    """
    name = "effects"

    def transform_clip_video(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        current_label = in_stream.name

        # 1. Blur effects
        for eff in clip.effects:
            etype = eff.type.lower()
            if etype == "blur":
                radius = eff.parameters.get("radius", 8)
                out_label = context.generate_label("v_blur")
                context.add_node(FilterNode(
                    filter_name="boxblur",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={"luma_radius": str(radius), "luma_power": "2"}
                ))
                current_label = out_label

        # 2. Opacity / Transparency
        if clip.opacity < 1.0:
            out_label = context.generate_label("v_opac")
            context.add_node(FilterNode(
                filter_name="colorchannelmixer",
                inputs=[current_label],
                outputs=[out_label],
                args={"aa": str(round(clip.opacity, 3))}
            ))
            current_label = out_label

        # 3. Rotation (if non-zero)
        if clip.rotation != 0.0:
            out_label = context.generate_label("v_rot")
            # Rotate in radians
            angle_rad = round(clip.rotation * (3.14159265 / 180.0), 4)
            context.add_node(FilterNode(
                filter_name="rotate",
                inputs=[current_label],
                outputs=[out_label],
                args={"a": str(angle_rad), "ow": "rotw(a)", "oh": "roth(a)"}
            ))
            current_label = out_label

        return FilterStream(name=current_label, stream_type="video", duration=in_stream.duration)
