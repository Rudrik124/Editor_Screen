import os
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
from app.core.config import settings
from app.engine.models import CompilationContext, FilterStream, FilterNode
from app.engine.plugins.trim_speed import TrimSpeedPlugin
from app.engine.plugins.filters_color import ColorFilterPlugin
from app.engine.plugins.effects import EffectsPlugin
from app.engine.plugins.audio import AudioPlugin
from app.engine.plugins.text_subtitles import TextSubtitlePlugin
from app.engine.plugins.transitions import TransitionPlugin
from app.schemas.timeline import TimelineExportRequest, ClipSchema, TrackSchema

class TimelineCompiler:
    """
    Modular compiler that transforms a normalized Zustand timeline manifest
    into deterministic FFmpeg input maps, complex filter graphs, and output arguments.
    """

    def __init__(self):
        self.trim_speed_plugin = TrimSpeedPlugin()
        self.color_plugin = ColorFilterPlugin()
        self.effects_plugin = EffectsPlugin()
        self.audio_plugin = AudioPlugin()
        self.text_plugin = TextSubtitlePlugin()
        self.transition_plugin = TransitionPlugin()

    def compile(
        self,
        request: TimelineExportRequest,
        output_filepath: str
    ) -> Tuple[List[str], float]:
        """
        Compiles TimelineExportRequest into command arguments and total duration.
        Returns: (cmd_args, total_duration_seconds)
        """
        # Calculate total duration
        total_duration = 0.0
        for clip in request.clips:
            end_time = clip.start + clip.duration
            if end_time > total_duration:
                total_duration = end_time
        total_duration = max(1.0, round(total_duration, 3))

        context = CompilationContext(
            width=request.width,
            height=request.height,
            fps=request.fps,
            quality=request.quality,
            total_duration=total_duration
        )

        # 1. Base Canvas Generator (Black background matching export dimensions and duration)
        canvas_label = context.generate_label("canvas")
        context.add_node(FilterNode(
            filter_name="color",
            inputs=[],
            outputs=[canvas_label],
            args={
                "c": "black",
                "s": f"{request.width}x{request.height}",
                "r": str(request.fps),
                "d": str(total_duration)
            }
        ))

        # 2. Process Clips (sorted by track layer order and start time)
        track_order = {t.id: idx for idx, t in enumerate(request.tracks)}
        sorted_clips = sorted(request.clips, key=lambda c: (track_order.get(c.trackId, 0), c.start))

        video_overlay_streams: List[Tuple[ClipSchema, FilterStream]] = []
        audio_streams: List[FilterStream] = []

        for clip in sorted_clips:
            # Resolve media file
            media_path = self._resolve_media_path(clip.mediaUrl)
            input_idx = context.register_input_file(media_path) if media_path else None

            # Process Video Stream
            if clip.type in ("video", "text"):
                if input_idx is not None:
                    raw_v = context.generate_label("v_raw")
                    context.add_node(FilterNode(
                        filter_name="format",
                        inputs=[f"{input_idx}:v"],
                        outputs=[raw_v],
                        args={"pix_fmts": "yuv420p"}
                    ))
                    # Normalization: Scale, Pad to uniform aspect ratio, setsar, fps
                    norm_v = context.generate_label("v_norm")
                    context.add_node(FilterNode(
                        filter_name="scale",
                        inputs=[raw_v],
                        outputs=[norm_v + "_scaled"],
                        args={
                            "w": str(request.width),
                            "h": str(request.height),
                            "force_original_aspect_ratio": "decrease"
                        }
                    ))
                    context.add_node(FilterNode(
                        filter_name="pad",
                        inputs=[norm_v + "_scaled"],
                        outputs=[norm_v + "_padded"],
                        args={
                            "w": str(request.width),
                            "h": str(request.height),
                            "x": "(ow-iw)/2",
                            "y": "(oh-ih)/2"
                        }
                    ))
                    context.add_node(FilterNode(
                        filter_name="setsar",
                        inputs=[norm_v + "_padded"],
                        outputs=[norm_v],
                        args={"sar": "1"}
                    ))
                    stream = FilterStream(name=norm_v, stream_type="video", duration=clip.duration)
                else:
                    # Text-only clip or synthetic fallback canvas
                    bg_color = "black@0.0" if clip.type == "text" else "black@1.0"
                    txt_canvas = context.generate_label("txt_canvas")
                    context.add_node(FilterNode(
                        filter_name="color",
                        inputs=[],
                        outputs=[txt_canvas],
                        args={
                            "c": bg_color,
                            "s": f"{request.width}x{request.height}",
                            "r": str(request.fps),
                            "d": str(clip.duration)
                        }
                    ))
                    stream = FilterStream(name=txt_canvas, stream_type="video", duration=clip.duration)

                # Execute Plugin Pipeline in strict sequence
                stream = self.trim_speed_plugin.transform_clip_video(context, clip, stream)
                stream = self.color_plugin.transform_clip_video(context, clip, stream)
                stream = self.effects_plugin.transform_clip_video(context, clip, stream)
                stream = self.text_plugin.transform_clip_video(context, clip, stream)

                # Phase 3 Transform: Scale (PIP)
                if clip.scale and abs(clip.scale - 1.0) > 0.01:
                    scaled_label = context.generate_label("v_scale")
                    target_w = max(2, int(round(request.width * clip.scale / 2)) * 2)
                    context.add_node(FilterNode(
                        filter_name="scale",
                        inputs=[stream.name],
                        outputs=[scaled_label],
                        args={"w": str(target_w), "h": "-1"}
                    ))
                    stream = FilterStream(name=scaled_label, stream_type="video", duration=stream.duration)

                # Phase 3 Transform: Opacity
                if clip.opacity is not None and clip.opacity < 0.999:
                    rgba_label = context.generate_label("v_rgba")
                    context.add_node(FilterNode(
                        filter_name="format",
                        inputs=[stream.name],
                        outputs=[rgba_label],
                        args={"pix_fmts": "yuva420p"}
                    ))
                    op_label = context.generate_label("v_opacity")
                    context.add_node(FilterNode(
                        filter_name="colorchannelmixer",
                        inputs=[rgba_label],
                        outputs=[op_label],
                        args={"aa": f"{clip.opacity:.2f}"}
                    ))
                    stream = FilterStream(name=op_label, stream_type="video", duration=stream.duration)

                video_overlay_streams.append((clip, stream))

            # Process Audio Stream (exclude frozen clips as freeze frames have no audio)
            if clip.type in ("video", "audio", "music") and input_idx is not None and not clip.isFrozen:
                raw_a = context.generate_label("a_raw")
                context.add_node(FilterNode(
                    filter_name="aformat",
                    inputs=[f"{input_idx}:a?"],
                    outputs=[raw_a],
                    args={"sample_fmts": "fltp", "sample_rates": "44100", "channel_layouts": "stereo"}
                ))
                a_stream = FilterStream(name=raw_a, stream_type="audio", duration=clip.duration)
                a_stream = self.trim_speed_plugin.transform_clip_audio(context, clip, a_stream)
                a_stream = self.audio_plugin.transform_clip_audio(context, clip, a_stream)
                audio_streams.append(a_stream)

        # 3. Layer Video Overlays onto Background Canvas (Track-aware with Transitions)
        streams_by_track: Dict[str, List[Tuple[ClipSchema, FilterStream]]] = {}
        for clip, v_stream in video_overlay_streams:
            streams_by_track.setdefault(clip.trackId, []).append((clip, v_stream))

        current_canvas = canvas_label
        for track in request.tracks:
            track_items = streams_by_track.get(track.id, [])
            if not track_items:
                continue

            # Check if this track contains clips with transitions
            has_transitions = any(c.transition for c, _ in track_items)
            if has_transitions and len(track_items) > 1:
                composed_track_stream = self.transition_plugin.compose_track_video_clips(
                    context, track_items
                )
                if composed_track_stream:
                    next_canvas = context.generate_label("canvas")
                    t_start = track_items[0][0].start
                    t_end = t_start + composed_track_stream.duration
                    enable_expr = f"between(t,{t_start},{t_end})"
                    context.add_node(FilterNode(
                        filter_name="overlay",
                        inputs=[current_canvas, composed_track_stream.name],
                        outputs=[next_canvas],
                        args={
                            "enable": f"'{enable_expr}'",
                            "x": "0",
                            "y": "0",
                            "eof_action": "pass"
                        }
                    ))
                    current_canvas = next_canvas
                    continue

            # Default layer-by-layer overlay for separate clips / overlays
            for clip, v_stream in track_items:
                next_canvas = context.generate_label("canvas")
                enable_expr = f"between(t,{clip.start},{clip.start + clip.duration})"
                context.add_node(FilterNode(
                    filter_name="overlay",
                    inputs=[current_canvas, v_stream.name],
                    outputs=[next_canvas],
                    args={
                        "enable": f"'{enable_expr}'",
                        "x": str(int(clip.positionX)),
                        "y": str(int(clip.positionY)),
                        "eof_action": "pass"
                    }
                ))
                current_canvas = next_canvas

        master_video_stream = current_canvas

        # 4. Mix Audio Streams
        master_audio_stream = AudioPlugin.mix_audio_streams(context, audio_streams)

        # 5. Build Final FFmpeg Command Argument List
        input_args: List[str] = []
        # Sort inputs by their assigned index
        sorted_inputs = sorted(context.input_files.items(), key=lambda x: x[1])
        for file_path, _ in sorted_inputs:
            input_args.extend(["-i", file_path])

        silent_audio_input_index: Optional[int] = None
        if not master_audio_stream:
            silent_audio_input_index = len(sorted_inputs)
            input_args.extend([
                "-f", "lavfi",
                "-i", "anullsrc=r=44100:cl=stereo",
            ])

        filter_complex_str = context.build_filter_complex_string()

        output_maps = ["-map", f"[{master_video_stream}]"]
        if master_audio_stream:
            output_maps.extend(["-map", f"[{master_audio_stream.name}]", "-c:a", "aac", "-b:a", "192k"])
        else:
            # Add silent audio track if no audio exists so players don't stutter
            output_maps.extend([
                "-map", f"{silent_audio_input_index}:a",
                "-shortest",
                "-c:a", "aac",
                "-b:a", "192k",
            ])

        # Quality settings
        crf = "23" if request.quality == "standard" else ("18" if request.quality == "high" else "28")
        preset = "medium" if request.quality == "standard" else ("slow" if request.quality == "high" else "veryfast")

        ffmpeg_bin = settings.get_ffmpeg_path()
        cmd = [
            ffmpeg_bin,
            "-y",
            *input_args,
            "-filter_complex", filter_complex_str,
            *output_maps,
            "-c:v", "libx264",
            "-crf", crf,
            "-preset", preset,
            "-pix_fmt", "yuv420p",
            "-t", str(total_duration),
            "-progress", "pipe:1",
            "-nostats",
            output_filepath
        ]

        return cmd, total_duration

    def _resolve_media_path(self, media_url: Optional[str]) -> Optional[str]:
        """Resolves media URL to local storage file path or valid filesystem file."""
        if not media_url:
            return None
        
        # Check if local storage path
        if media_url.startswith("/uploads/") or media_url.startswith("uploads/"):
            filename = Path(media_url).name
            candidate = settings.UPLOAD_DIR / filename
            if candidate.exists():
                return str(candidate)

        # Check if direct local absolute path (e.g. from tests or local ingestion)
        local_p = Path(media_url)
        if local_p.exists() and local_p.is_file():
            return str(local_p)

        return None
