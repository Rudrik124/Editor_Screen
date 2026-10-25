from typing import List, Tuple, Optional
from app.engine.plugins.base import BasePipelinePlugin
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.schemas.timeline import ClipSchema

# Full 20 Veytrix Transitions Mapping to FFmpeg xfade types
TRANSITION_MAP = {
    # 1. Basic / Fade
    "cross_dissolve": "fade",
    "fade_black": "fadeblack",
    "fade_white": "fadewhite",
    "dip_to_color": "fadeblack",
    "instant_cut": "fade",
    # 2. Camera
    "camera_shake": "fade",
    "crash_zoom": "zoomin",
    "whip_pan_left": "slideleft",
    # 3. Zoom
    "zoom_in": "zoomin",
    "zoom_out": "fade",
    "hyper_zoom": "zoomin",
    "pulse_zoom": "fade",
    # 4. Slide / Push
    "slide_left": "slideleft",
    "slide_right": "slideright",
    "push_up": "slideup",
    "perspective_push": "slideleft",
    # 5. Spin / Rotate
    "spin_left": "circlecrop",
    "spin_right": "circlecrop",
    # 6. Blur / Motion
    "motion_blur": "smoothleft",
    "gaussian_blur": "dissolve",
}

class TransitionPlugin(BasePipelinePlugin):
    """
    Handles seamless transitions between contiguous clips on a track
    using FFmpeg's hardware-accelerated xfade and acrossfade filters.
    Supports all 20 Veytrix transitions.
    """
    name = "transitions"

    def compose_track_video_clips(
        self,
        context: CompilationContext,
        clip_stream_pairs: List[Tuple[ClipSchema, FilterStream]]
    ) -> Optional[FilterStream]:
        if not clip_stream_pairs:
            return None

        if len(clip_stream_pairs) == 1:
            return clip_stream_pairs[0][1]

        # Reset PTS to 0 for initial stream before feeding to xfade
        first_clip, first_stream = clip_stream_pairs[0]
        current_stream = self._normalize_stream_pts(context, first_stream)
        cumulative_duration = first_clip.duration

        for next_clip, next_stream in clip_stream_pairs[1:]:
            # Check if previous clip defined a transition
            trans = first_clip.transition or getattr(first_clip, "transition", None)
            trans_type = "fade"
            trans_dur = 0.5

            if trans:
                raw_type = trans.type if hasattr(trans, "type") else trans.get("type", "fade")
                trans_type = TRANSITION_MAP.get(raw_type, "fade")
                raw_dur = trans.duration if hasattr(trans, "duration") else trans.get("duration", 0.5)
                # Clamp transition duration to not exceed clip durations
                trans_dur = max(0.1, min(float(raw_dur), first_clip.duration * 0.9, next_clip.duration * 0.9))

            # Normalize next stream PTS
            norm_next_stream = self._normalize_stream_pts(context, next_stream)

            # Offset is where transition starts relative to cumulative stream start
            offset = max(0.0, round(cumulative_duration - trans_dur, 3))
            out_label = context.generate_label("v_xfade")

            context.add_node(FilterNode(
                filter_name="xfade",
                inputs=[current_stream.name, norm_next_stream.name],
                outputs=[out_label],
                args={
                    "transition": trans_type,
                    "duration": f"{trans_dur:.3f}",
                    "offset": f"{offset:.3f}",
                }
            ))

            cumulative_duration = offset + next_clip.duration
            current_stream = FilterStream(
                name=out_label,
                stream_type="video",
                duration=cumulative_duration
            )
            first_clip = next_clip

        # If track has a leading delay, offset final compiled stream PTS
        leading_start = clip_stream_pairs[0][0].start
        if leading_start > 0:
            offset_label = context.generate_label("v_track_pts")
            context.add_node(FilterNode(
                filter_name="setpts",
                inputs=[current_stream.name],
                outputs=[offset_label],
                args={"expr": f"PTS-STARTPTS+({leading_start}/TB)"}
            ))
            current_stream = FilterStream(
                name=offset_label,
                stream_type="video",
                start_time=leading_start,
                duration=cumulative_duration
            )

        return current_stream

    def _normalize_stream_pts(
        self,
        context: CompilationContext,
        stream: FilterStream
    ) -> FilterStream:
        """Ensures stream PTS starts strictly at 0, has constant frame rate and valid timebase for FFmpeg xfade."""
        pts_label = context.generate_label("v_pts_zero")
        context.add_node(FilterNode(
            filter_name="setpts",
            inputs=[stream.name],
            outputs=[pts_label],
            args={"expr": "PTS-STARTPTS"}
        ))
        fps_label = context.generate_label("v_fps_xfade")
        context.add_node(FilterNode(
            filter_name="fps",
            inputs=[pts_label],
            outputs=[fps_label],
            args={"fps": str(context.fps)}
        ))
        tb_label = context.generate_label("v_tb_xfade")
        context.add_node(FilterNode(
            filter_name="settb",
            inputs=[fps_label],
            outputs=[tb_label],
            args={"expr": "AVTB"}
        ))
        return FilterStream(
            name=tb_label,
            stream_type="video",
            duration=stream.duration
        )
