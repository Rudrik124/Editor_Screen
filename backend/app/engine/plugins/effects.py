import math
from typing import Dict, Any
from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema

class EffectsPlugin(BasePipelinePlugin):
    """
    Applies motion transforms, zoom animations, rotation, and blur effects for FFmpeg export.
    Positional motion (move_*, drop, bounce, shake_in) is handled via dynamic overlay coordinates.
    """
    name = "effects"

    def transform_clip_video(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        current_label = in_stream.name
        dur = max(0.1, clip.duration)
        cw = getattr(context, "width", 1920)
        ch = getattr(context, "height", 1080)

        for eff in clip.effects:
            etype = eff.type.lower()
            p = eff.parameters or {}

            # 1. Fade In
            if etype == "fade_in":
                duration = float(p.get("duration", 1.0))
                out_label = context.generate_label("v_fadein")
                context.add_node(FilterNode(
                    filter_name="fade",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={"t": "in", "st": "0", "d": str(duration)}
                ))
                current_label = out_label

            # 2. Fade Out
            elif etype == "fade_out":
                duration = float(p.get("duration", 1.0))
                st = max(0.0, dur - duration)
                out_label = context.generate_label("v_fadeout")
                context.add_node(FilterNode(
                    filter_name="fade",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={"t": "out", "st": str(round(st, 3)), "d": str(duration)}
                ))
                current_label = out_label

            # 3. Zoom In
            elif etype == "zoom_in":
                zoom = float(p.get("zoomAmount", 1.5))
                out_label = context.generate_label("v_zoomin")
                context.add_node(FilterNode(
                    filter_name="zoompan",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "z": f"min(1.0+({zoom}-1.0)*(on/({dur}*30)),{zoom})",
                        "d": "1",
                        "x": "iw/2-(iw/zoom/2)",
                        "y": "ih/2-(ih/zoom/2)",
                        "s": f"{cw}x{ch}",
                        "fps": "30"
                    }
                ))
                current_label = out_label

            # 4. Zoom Out
            elif etype == "zoom_out":
                zoom = float(p.get("zoomAmount", 1.5))
                out_label = context.generate_label("v_zoomout")
                context.add_node(FilterNode(
                    filter_name="zoompan",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "z": f"max(1.0,{zoom}-({zoom}-1.0)*(on/({dur}*30)))",
                        "d": "1",
                        "x": "iw/2-(iw/zoom/2)",
                        "y": "ih/2-(ih/zoom/2)",
                        "s": f"{cw}x{ch}",
                        "fps": "30"
                    }
                ))
                current_label = out_label

            # 5. Spin
            elif etype == "spin":
                speed = float(p.get("speed", 1.0))
                direction = float(p.get("direction", 1.0))
                out_label = context.generate_label("v_spin")
                context.add_node(FilterNode(
                    filter_name="rotate",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "a": f"{direction * speed * 2.0 * math.pi}*t",
                        "ow": "iw",
                        "oh": "ih",
                        "c": "none"
                    }
                ))
                current_label = out_label

            # 6-10. Positional Effects: handled cleanly in compiler.py overlay stage
            # (drop, move_left, move_right, move_up, move_down, bounce, shake_in)

            # 12. Zoom Bounce (Scale Spring)
            elif etype == "zoom_bounce":
                zoom = float(p.get("zoom", 0.4))
                speed = float(p.get("speed", 3.0))
                damping = float(p.get("damping", 2.5))
                out_label = context.generate_label("v_zoombounce")
                context.add_node(FilterNode(
                    filter_name="zoompan",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "z": f"max(0.01,1.0+{zoom}*exp(-{damping}*on/30)*cos({speed}*on/30))",
                        "d": "1",
                        "x": "iw/2-(iw/zoom/2)",
                        "y": "ih/2-(ih/zoom/2)",
                        "s": f"{cw}x{ch}",
                        "fps": "30"
                    }
                ))
                current_label = out_label

            # 13. Pulse (Continuous Oscillation)
            elif etype == "pulse":
                intensity = float(p.get("intensity", 0.1))
                speed = float(p.get("speed", 2.0))
                out_label = context.generate_label("v_pulse")
                context.add_node(FilterNode(
                    filter_name="zoompan",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "z": f"max(0.01,1.0+{intensity}*sin({2.0 * math.pi * speed}*on/30))",
                        "d": "1",
                        "x": "iw/2-(iw/zoom/2)",
                        "y": "ih/2-(ih/zoom/2)",
                        "s": f"{cw}x{ch}",
                        "fps": "30"
                    }
                ))
                current_label = out_label

            # 14. Pop In
            elif etype == "pop_in":
                speed = float(p.get("speed", 2.0))
                out_label = context.generate_label("v_popin")
                context.add_node(FilterNode(
                    filter_name="zoompan",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "z": f"max(0.01,2.70158*pow(min(1.0,(on/30)*{speed})-1.0,3)+1.70158*pow(min(1.0,(on/30)*{speed})-1.0,2)+1.0)",
                        "d": "1",
                        "x": "iw/2-(iw/zoom/2)",
                        "y": "ih/2-(ih/zoom/2)",
                        "s": f"{cw}x{ch}",
                        "fps": "30"
                    }
                ))
                current_label = out_label

            # 15. Pop Out
            elif etype == "pop_out":
                speed = float(p.get("speed", 2.0))
                st_frame = max(0, int((dur - 0.4) * 30))
                out_label = context.generate_label("v_popout")
                context.add_node(FilterNode(
                    filter_name="zoompan",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "z": f"if(lt(on,{st_frame}),1.0,max(0.01,1.0-(2.70158*pow(min(1.0,(on-{st_frame})/12),3)-1.70158*pow(min(1.0,(on-{st_frame})/12),2))))",
                        "d": "1",
                        "x": "iw/2-(iw/zoom/2)",
                        "y": "ih/2-(ih/zoom/2)",
                        "s": f"{cw}x{ch}",
                        "fps": "30"
                    }
                ))
                current_label = out_label

            # 16. Expand (Anamorphic horizontal / uniform scale)
            elif etype == "expand":
                sx = float(p.get("scaleX", 1.4))
                duration = float(p.get("duration", 0.6))
                frames = max(1, int(duration * 30))
                out_label = context.generate_label("v_expand")
                context.add_node(FilterNode(
                    filter_name="zoompan",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "z": f"1.0+({sx}-1.0)*min(1.0,on/{frames})",
                        "d": "1",
                        "x": "iw/2-(iw/zoom/2)",
                        "y": "ih/2-(ih/zoom/2)",
                        "s": f"{cw}x{ch}",
                        "fps": "30"
                    }
                ))
                current_label = out_label

            # 17. Collapse
            elif etype == "collapse":
                duration = float(p.get("duration", 0.6))
                st_frame = max(0, int((dur - duration) * 30))
                dur_frames = max(1, int(duration * 30))
                out_label = context.generate_label("v_collapse")
                context.add_node(FilterNode(
                    filter_name="zoompan",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "z": f"if(lt(on,{st_frame}),1.0,max(0.01,1.0-(on-{st_frame})/{dur_frames}))",
                        "d": "1",
                        "x": "iw/2-(iw/zoom/2)",
                        "y": "ih/2-(ih/zoom/2)",
                        "s": f"{cw}x{ch}",
                        "fps": "30"
                    }
                ))
                current_label = out_label

            # 18. Swing (Pendulum sway)
            elif etype == "swing":
                angle = float(p.get("swingAngle", 25.0)) * (math.pi / 180.0)
                speed = float(p.get("speed", 2.0))
                decay = float(p.get("damping", 1.5))
                out_label = context.generate_label("v_swing")
                context.add_node(FilterNode(
                    filter_name="rotate",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "a": f"{angle}*cos({speed}*t)*exp(-{decay}*t)",
                        "ow": "iw",
                        "oh": "ih",
                        "c": "none"
                    }
                ))
                current_label = out_label

            # 20. Wiggle
            elif etype == "wiggle":
                angle = float(p.get("strength", 12.0)) * (math.pi / 180.0)
                speed = float(p.get("speed", 1.5))
                out_label = context.generate_label("v_wiggle")
                context.add_node(FilterNode(
                    filter_name="rotate",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={
                        "a": f"{angle}*sin({speed}*t*2.5)",
                        "ow": "iw",
                        "oh": "ih",
                        "c": "none"
                    }
                ))
                current_label = out_label

            # Legacy / Optional Blur
            elif etype == "blur":
                radius = p.get("radius", 8)
                out_label = context.generate_label("v_blur")
                context.add_node(FilterNode(
                    filter_name="boxblur",
                    inputs=[current_label],
                    outputs=[out_label],
                    args={"luma_radius": str(radius), "luma_power": "2"}
                ))
                current_label = out_label

        # Base Opacity / Transparency
        if clip.opacity < 1.0:
            out_label = context.generate_label("v_opac")
            context.add_node(FilterNode(
                filter_name="colorchannelmixer",
                inputs=[current_label],
                outputs=[out_label],
                args={"aa": str(round(clip.opacity, 3))}
            ))
            current_label = out_label

        # Base Rotation
        if clip.rotation != 0.0:
            out_label = context.generate_label("v_rot")
            angle_rad = round(clip.rotation * (3.14159265 / 180.0), 4)
            context.add_node(FilterNode(
                filter_name="rotate",
                inputs=[current_label],
                outputs=[out_label],
                args={"a": str(angle_rad), "ow": "iw", "oh": "ih", "c": "none"}
            ))
            current_label = out_label

        # Normalize pixel format to yuv420p so zoompan/rotate output maintains valid format
        if clip.effects:
            eff_fmt_label = context.generate_label("v_eff_fmt")
            context.add_node(FilterNode(
                filter_name="format",
                inputs=[current_label],
                outputs=[eff_fmt_label],
                args={"pix_fmts": "yuv420p"}
            ))
            current_label = eff_fmt_label

        return FilterStream(name=current_label, stream_type="video", duration=in_stream.duration)
