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
        # Calculate total duration accounting for transitions
        total_duration = 0.0
        for track in request.tracks:
            t_clips = [c for c in request.clips if c.trackId == track.id]
            t_clips.sort(key=lambda c: c.start)
            if not t_clips:
                continue
            t_start = t_clips[0].start
            t_dur = sum(c.duration for c in t_clips)
            for i in range(len(t_clips) - 1):
                c1, c2 = t_clips[i], t_clips[i+1]
                trans = c1.transition or c2.transition
                if trans:
                    raw_type = trans.type if hasattr(trans, "type") else trans.get("type", None)
                    raw_dur = trans.duration if hasattr(trans, "duration") else trans.get("duration", 0.5)
                    if raw_type != "instant_cut" and float(raw_dur) > 0.001:
                        trans_dur = max(0.05, min(float(raw_dur), c1.duration * 0.9, c2.duration * 0.9))
                        t_dur -= trans_dur
            track_end = t_start + max(0.0, t_dur)
            if track_end > total_duration:
                total_duration = track_end

        if total_duration <= 0.0:
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
            if clip.type in ("video", "text", "image"):
                if input_idx is not None:
                    raw_v = context.generate_label("v_raw")
                    is_img = clip.type == "image" or (media_path and any(str(media_path).lower().endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.svg')))
                    if is_img:
                        context.add_node(FilterNode(
                            filter_name="loop",
                            inputs=[f"{input_idx}:v"],
                            outputs=[raw_v + "_looped"],
                            args={"loop": "-1", "size": "1", "start": "0"}
                        ))
                        context.add_node(FilterNode(
                            filter_name="format",
                            inputs=[raw_v + "_looped"],
                            outputs=[raw_v],
                            args={"pix_fmts": "yuv420p"}
                        ))
                    else:
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

                # Phase 3 Transform: Opacity / Keyframes
                op_kfs = [k for k in clip.keyframes if k.property == "opacity"] if clip.keyframes else []
                if op_kfs or (clip.opacity is not None and clip.opacity < 0.999):
                    rgba_label = context.generate_label("v_rgba")
                    context.add_node(FilterNode(
                        filter_name="format",
                        inputs=[stream.name],
                        outputs=[rgba_label],
                        args={"pix_fmts": "yuva420p"}
                    ))
                    op_label = context.generate_label("v_opacity")
                    if op_kfs:
                        sorted_op = sorted(op_kfs, key=lambda k: k.timeOffset)
                        first_val = float(sorted_op[0].value)
                        last_val = float(sorted_op[-1].value)
                        if len(sorted_op) >= 2 and first_val < last_val:
                            dur = max(0.1, sorted_op[-1].timeOffset - sorted_op[0].timeOffset)
                            st = clip.start + sorted_op[0].timeOffset
                            context.add_node(FilterNode(
                                filter_name="fade",
                                inputs=[rgba_label],
                                outputs=[op_label],
                                args={"t": "in", "st": f"{st:.2f}", "d": f"{dur:.2f}", "alpha": "1"}
                            ))
                        elif len(sorted_op) >= 2 and first_val > last_val:
                            dur = max(0.1, sorted_op[-1].timeOffset - sorted_op[0].timeOffset)
                            st = clip.start + sorted_op[0].timeOffset
                            context.add_node(FilterNode(
                                filter_name="fade",
                                inputs=[rgba_label],
                                outputs=[op_label],
                                args={"t": "out", "st": f"{st:.2f}", "d": f"{dur:.2f}", "alpha": "1"}
                            ))
                        else:
                            context.add_node(FilterNode(
                                filter_name="colorchannelmixer",
                                inputs=[rgba_label],
                                outputs=[op_label],
                                args={"aa": f"{last_val:.2f}"}
                            ))
                    else:
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

        # Order tracks: main video spine FIRST (background), then overlay/PIP tracks, then text
        def get_track_layer_priority(t: TrackSchema) -> int:
            if t.id == "video":
                return 0
            if "overlay" in t.id or t.type == "video":
                return 1
            if t.type == "text" or t.id == "text":
                return 2
            return 1

        ordered_tracks = sorted(request.tracks, key=get_track_layer_priority)

        current_canvas = canvas_label
        for track in ordered_tracks:
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
                    overlay_args = {
                        "x": "0",
                        "y": "0",
                        "eof_action": "pass"
                    }
                    if t_start > 0:
                        overlay_args["enable"] = f"'gte(t,{t_start})'"
                    context.add_node(FilterNode(
                        filter_name="overlay",
                        inputs=[current_canvas, composed_track_stream.name],
                        outputs=[next_canvas],
                        args=overlay_args
                    ))
                    current_canvas = next_canvas
                    continue

            # Default layer-by-layer overlay for separate clips / overlays
            for clip, v_stream in track_items:
                next_canvas = context.generate_label("canvas")
                enable_expr = f"between(t,{clip.start},{clip.start + clip.duration})"

                # Keyframes support for positionX and positionY
                pos_x_kfs = [k for k in clip.keyframes if k.property == "positionX"] if clip.keyframes else []
                pos_y_kfs = [k for k in clip.keyframes if k.property == "positionY"] if clip.keyframes else []

                if pos_x_kfs:
                    sorted_x = sorted(pos_x_kfs, key=lambda k: k.timeOffset)
                    expr_parts = []
                    for i in range(len(sorted_x) - 1):
                        k1, k2 = sorted_x[i], sorted_x[i+1]
                        dt = max(0.001, k2.timeOffset - k1.timeOffset)
                        expr_parts.append(f"if(between(t,{clip.start + k1.timeOffset},{clip.start + k2.timeOffset}),{k1.value}+({k2.value}-{k1.value})*(t-({clip.start + k1.timeOffset}))/{dt}")
                    x_pos = "".join(expr_parts) + f",{sorted_x[-1].value}" + (")" * len(expr_parts))
                elif clip.positionX < 0:
                    target_w = int(round(request.width * clip.scale)) if clip.scale and clip.scale < 0.99 else request.width
                    x_pos = str(max(0, int((request.width - target_w) / 2 + clip.positionX)))
                elif clip.positionX == 0 and clip.scale and clip.scale < 0.99 and clip.trackId != "video":
                    target_w = int(round(request.width * clip.scale))
                    x_pos = str(int((request.width - target_w) / 2))
                else:
                    x_pos = str(int(clip.positionX))

                if pos_y_kfs:
                    sorted_y = sorted(pos_y_kfs, key=lambda k: k.timeOffset)
                    expr_parts = []
                    for i in range(len(sorted_y) - 1):
                        k1, k2 = sorted_y[i], sorted_y[i+1]
                        dt = max(0.001, k2.timeOffset - k1.timeOffset)
                        expr_parts.append(f"if(between(t,{clip.start + k1.timeOffset},{clip.start + k2.timeOffset}),{k1.value}+({k2.value}-{k1.value})*(t-({clip.start + k1.timeOffset}))/{dt}")
                    y_pos = "".join(expr_parts) + f",{sorted_y[-1].value}" + (")" * len(expr_parts))
                elif clip.positionY < 0:
                    target_h = int(round(request.height * clip.scale)) if clip.scale and clip.scale < 0.99 else request.height
                    y_pos = str(max(0, int((request.height - target_h) / 2 + clip.positionY)))
                elif clip.positionY == 0 and clip.scale and clip.scale < 0.99 and clip.trackId != "video":
                    target_h = int(round(request.height * clip.scale))
                    y_pos = str(int((request.height - target_h) / 2))
                else:
                    y_pos = str(int(clip.positionY))

                context.add_node(FilterNode(
                    filter_name="overlay",
                    inputs=[current_canvas, v_stream.name],
                    outputs=[next_canvas],
                    args={
                        "enable": f"'{enable_expr}'",
                        "x": x_pos,
                        "y": y_pos,
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
        
        # Strip query parameters or hashes
        clean_url = media_url.split("?")[0].split("#")[0]

        # 1. Check if local upload path or URL containing /uploads/
        if "/uploads/" in clean_url or clean_url.startswith("uploads/"):
            filename = Path(clean_url).name
            candidate = settings.UPLOAD_DIR / filename
            if candidate.exists():
                return str(candidate)

        # 2. Check if direct local absolute or relative path
        local_p = Path(clean_url)
        if local_p.exists() and local_p.is_file():
            return str(local_p)

        # 3. Check within settings.STORAGE_DIR
        storage_candidate = settings.STORAGE_DIR / Path(clean_url).name
        if storage_candidate.exists() and storage_candidate.is_file():
            return str(storage_candidate)

        # 4. Check if remote HTTP/HTTPS URL
        if clean_url.startswith("http://") or clean_url.startswith("https://"):
            filename = Path(clean_url).name
            candidate = settings.UPLOAD_DIR / filename
            if candidate.exists():
                return str(candidate)
            # Pass remote URL to FFmpeg
            return media_url

        # 5. Fallback for sample clips / blob URLs: find existing test/sample video
        sim_video = settings.STORAGE_DIR / "test_user_sim.mp4"
        if sim_video.exists():
            return str(sim_video)

        upload_files = list(settings.UPLOAD_DIR.glob("*.mp4"))
        if upload_files:
            return str(upload_files[0])

        return None
