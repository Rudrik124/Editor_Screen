from typing import Dict, Any
from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema

class ColorFilterPlugin(BasePipelinePlugin):
    """
    Applies color grading, 20 categorized production filters, and adjustments.
    """
    name = "filters_color"

    # Pre-calculated recipe nodes for the 20 catalog filters
    FILTER_RECIPES = {
        # 1. Cinematic
        "hollywood_gold": [
            ("colorbalance", {"rh": ".18", "gh": ".08", "bh": "-.12", "rs": ".05"}),
            ("eq", {"contrast": "1.08"})
        ],
        "cinematic_lut": [
            ("colorbalance", {"rs": "-.1", "bs": ".15", "rm": ".12", "bm": "-.08"}),
            ("eq", {"contrast": "1.12", "saturation": "0.92"})
        ],
        "teal_and_orange": [
            ("colorbalance", {"rs": "-0.15", "gs": "0.0", "bs": "0.20", "rh": "0.22", "gh": "0.08", "bh": "-0.18"}),
            ("eq", {"contrast": "1.15"})
        ],
        "moody_film": [
            ("curves", {"all": "0/0.04 0.25/0.2 0.75/0.82 1/0.95"}),
            ("eq", {"saturation": "0.85"})
        ],

        # 2. Lighting & Tone
        "bright_pop": [
            ("eq", {"gamma": "1.15", "saturation": "1.25", "contrast": "1.05"})
        ],
        "deep_contrast": [
            ("eq", {"contrast": "1.35", "brightness": "-0.04", "saturation": "1.1"})
        ],
        "natural_tone": [
            ("eq", {"contrast": "1.02", "saturation": "1.04", "gamma": "1.01"})
        ],

        # 3. Portrait
        "natural_skin": [
            ("selectivecolor", {"reds": "0 -0.05 -0.05 0", "yellows": "0 0 -0.08 0"}),
            ("eq", {"saturation": "1.05"})
        ],
        "beauty_soft": [
            ("boxblur", {"luma_radius": "2", "luma_power": "1"})
        ],
        "fashion_look": [
            ("curves", {"preset": "lighter"}),
            ("eq", {"saturation": "1.18", "contrast": "1.1"})
        ],

        # 4. Vintage & Retro
        "film_grain": [
            ("noise", {"c1s": "18", "c1f": "t+u"}),
            ("eq", {"contrast": "1.05"})
        ],
        "vhs_classic": [
            ("chromashift", {"cbh": "4", "crh": "-4"})
        ],

        # 5. Black & White
        "pure_mono": [
            ("hue", {"s": "0"}),
            ("eq", {"contrast": "1.05"})
        ],
        "noir_bw": [
            ("hue", {"s": "0"}),
            ("curves", {"all": "0/0 0.3/0.15 0.7/0.88 1/1"}),
            ("vignette", {"angle": "PI/3.5"})
        ],

        # 6. Nature & Landscape
        "forest_green": [
            ("colorbalance", {"gs": ".14", "gm": ".18", "bm": "-.08"}),
            ("eq", {"saturation": "1.2"})
        ],
        "ocean_blue": [
            ("colorbalance", {"bs": ".22", "bm": ".18", "rs": "-.1"}),
            ("eq", {"contrast": "1.08", "saturation": "1.15"})
        ],

        # 7. Neon & Cyber
        "neon_blue": [
            ("colorbalance", {"bs": ".35", "gs": ".1", "rs": "-.2", "rm": ".2"}),
            ("eq", {"saturation": "1.4"})
        ],
        "cyberpunk": [
            ("colorbalance", {"rs": "-0.25", "gs": "0.1", "bs": "0.35", "rh": "0.35", "gh": "-0.1", "bh": "0.2"}),
            ("eq", {"contrast": "1.25"})
        ],

        # 8. Creative & Artistic
        "oil_painting": [
            ("boxblur", {"luma_radius": "3", "luma_power": "1"})
        ],
        "comic_book": [
            ("edgedetect", {"low": "0.1", "high": "0.4", "mode": "colormix"}),
            ("eq", {"contrast": "1.3", "saturation": "1.5"})
        ],
    }

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

            # 1. Catalog Recipes (20 Presets)
            if ftype in self.FILTER_RECIPES:
                for filter_name, args in self.FILTER_RECIPES[ftype]:
                    out_label = context.generate_label(f"v_{ftype[:4]}")
                    context.add_node(FilterNode(
                        filter_name=filter_name,
                        inputs=[current_label],
                        outputs=[out_label],
                        args=args
                    ))
                    current_label = out_label
                continue

            # 2. Direct adjustments (legacy/custom)
            if ftype in ("brightness", "contrast", "saturation"):
                out_label = context.generate_label("v_eq")
                args = {}
                if ftype == "brightness":
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

        # Normalize pixel format to yuv420p so downstream filters & overlay maintain valid chroma/alpha
        if clip.filters:
            fmt_label = context.generate_label("v_filt_fmt")
            context.add_node(FilterNode(
                filter_name="format",
                inputs=[current_label],
                outputs=[fmt_label],
                args={"pix_fmts": "yuv420p"}
            ))
            current_label = fmt_label

        return FilterStream(name=current_label, stream_type="video", duration=in_stream.duration)
