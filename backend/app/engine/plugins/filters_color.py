from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema

class ColorFilterPlugin(BasePipelinePlugin):
    """
    Applies color grading, brightness/contrast adjustments, and visual filters.
    """
    name = "filters_color"

    def transform_clip_video(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        current_label = in_stream.name

        for f in clip.filters:
            ftype = f.type.lower()
            intensity = f.intensity

            if ftype in ("brightness", "contrast", "saturation"):
                out_label = context.generate_label("v_eq")
                args = {}
                if ftype == "brightness":
                    # Maps 0.0-2.0 to -1.0 to 1.0 (default 1.0 -> 0.0)
                    args["brightness"] = str(round(intensity - 1.0, 3))
                elif ftype == "contrast":
                    args["contrast"] = str(round(intensity, 3))
                elif ftype == "saturation":
                    args["saturation"] = str(round(intensity, 3))

                context.add_node(FilterNode(
                    filter_name="eq",
                    inputs=[current_label],
                    outputs=[out_label],
                    args=args
                ))
                current_label = out_label

            elif ftype == "grayscale":
                out_label = context.generate_label("v_gray")
                context.add_node(FilterNode(
                    filter_name="colorchannelmixer",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "rr": ".3", "rg": ".4", "rb": ".3",
                        "gr": ".3", "gg": ".4", "gb": ".3",
                        "br": ".3", "bg": ".4", "bb": ".3"
                    }
                ))
                current_label = out_label

            elif ftype == "sepia":
                out_label = context.generate_label("v_sepia")
                context.add_node(FilterNode(
                    filter_name="colorchannelmixer",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "rr": ".393", "rg": ".769", "rb": ".189",
                        "gr": ".349", "gg": ".686", "gb": ".168",
                        "br": ".272", "bg": ".534", "bb": ".131"
                    }
                ))
                current_label = out_label

            elif ftype == "invert":
                out_label = context.generate_label("v_neg")
                context.add_node(FilterNode(
                    filter_name="negate",
                    inputs=[current_label],
                    outputs=[out_label]
                ))
                current_label = out_label

            elif ftype == "vignette":
                out_label = context.generate_label("v_vig")
                context.add_node(FilterNode(
                    filter_name="vignette",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={"angle": "PI/4"}
                ))
                current_label = out_label

        return FilterStream(name=current_label, stream_type="video", duration=in_stream.duration)
