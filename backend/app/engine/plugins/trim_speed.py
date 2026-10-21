from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema

class TrimSpeedPlugin(BasePipelinePlugin):
    """
    Handles clip trimming, playback speed scaling, reverse playback,
    and freeze frame loops using CapCut/VN sub-graph patterns.
    """
    name = "trim_speed"

    def transform_clip_video(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        current_label = in_stream.name

        # 1. Trimming (inPoint / outPoint)
        if clip.inPoint > 0 or (clip.outPoint is not None and clip.outPoint > clip.inPoint):
            out_label = context.generate_label("v_trim")
            args = {"start": str(clip.inPoint)}
            if clip.outPoint:
                args["end"] = str(clip.outPoint)
            
            # Trim and immediately normalize PTS to 0
            context.add_node(FilterNode(
                filter_name="trim",
                inputs=[current_label],
                outputs=[out_label + "_raw"],
                args=args
            ))
            pts_label = context.generate_label("v_pts")
            context.add_node(FilterNode(
                filter_name="setpts",
                inputs=[out_label + "_raw"],
                outputs=[pts_label],
                args={"expr": "PTS-STARTPTS"}
            ))
            current_label = pts_label

        # 2. Reverse playback
        if clip.reverse:
            rev_label = context.generate_label("v_rev")
            context.add_node(FilterNode(
                filter_name="reverse",
                inputs=[current_label],
                outputs=[rev_label]
            ))
            current_label = rev_label

        # 3. Playback speed adjustment
        if clip.speed and abs(clip.speed - 1.0) > 0.001:
            speed_label = context.generate_label("v_speed")
            pts_mult = round(1.0 / clip.speed, 6)
            context.add_node(FilterNode(
                filter_name="setpts",
                inputs=[current_label],
                outputs=[speed_label],
                args={"expr": f"{pts_mult}*PTS"}
            ))
            current_label = speed_label

        # 4. Freeze frame
        if clip.isFrozen:
            freeze_label = context.generate_label("v_freeze")
            freeze_dur = clip.duration
            context.add_node(FilterNode(
                filter_name="tpad",
                inputs=[current_label],
                outputs=[freeze_label],
                args={"stop_mode": "clone", "stop_duration": str(freeze_dur)}
            ))
            current_label = freeze_label

        return FilterStream(name=current_label, stream_type="video", duration=clip.duration)

    def transform_clip_audio(
        self,
        context: CompilationContext,
        clip: ClipSchema,
        in_stream: FilterStream
    ) -> FilterStream:
        current_label = in_stream.name

        # 1. Audio Trimming
        if clip.inPoint > 0 or (clip.outPoint is not None and clip.outPoint > clip.inPoint):
            out_label = context.generate_label("a_trim")
            args = {"start": str(clip.inPoint)}
            if clip.outPoint:
                args["end"] = str(clip.outPoint)
            context.add_node(FilterNode(
                filter_name="atrim",
                inputs=[current_label],
                outputs=[out_label + "_raw"],
                args=args
            ))
            pts_label = context.generate_label("a_pts")
            context.add_node(FilterNode(
                filter_name="asetpts",
                inputs=[out_label + "_raw"],
                outputs=[pts_label],
                args={"expr": "PTS-STARTPTS"}
            ))
            current_label = pts_label

        # 2. Audio Reverse
        if clip.reverse:
            rev_label = context.generate_label("a_rev")
            context.add_node(FilterNode(
                filter_name="areverse",
                inputs=[current_label],
                outputs=[rev_label]
            ))
            current_label = rev_label

        # 3. Audio Speed (Cascaded atempo: handles 0.05x to 100x)
        if clip.speed and abs(clip.speed - 1.0) > 0.001:
            speed = clip.speed
            while speed > 2.0:
                step_label = context.generate_label("a_tempo")
                context.add_node(FilterNode(
                    filter_name="atempo",
                    inputs=[current_label],
                    outputs=[step_label],
                    args={"tempo": "2.0"}
                ))
                current_label = step_label
                speed /= 2.0
            while speed < 0.5:
                step_label = context.generate_label("a_tempo")
                context.add_node(FilterNode(
                    filter_name="atempo",
                    inputs=[current_label],
                    outputs=[step_label],
                    args={"tempo": "0.5"}
                ))
                current_label = step_label
                speed /= 0.5
            
            # Final remaining tempo factor
            if abs(speed - 1.0) > 0.001:
                step_label = context.generate_label("a_tempo")
                context.add_node(FilterNode(
                    filter_name="atempo",
                    inputs=[current_label],
                    outputs=[step_label],
                    args={"tempo": str(round(speed, 4))}
                ))
                current_label = step_label

        return FilterStream(name=current_label, stream_type="audio", duration=clip.duration)
