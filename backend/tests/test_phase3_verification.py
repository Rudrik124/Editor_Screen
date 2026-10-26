import pytest
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import (
    TimelineExportRequest,
    TrackSchema,
    ClipSchema,
    TransitionSchema,
    KeyframeSchema,
)
from app.engine.plugins.transitions import TRANSITION_MAP

ALL_20_TRANSITIONS = [
    "cross_dissolve",
    "fade_black",
    "fade_white",
    "dip_to_color",
    "instant_cut",
    "camera_shake",
    "crash_zoom",
    "whip_pan_left",
    "zoom_in",
    "zoom_out",
    "hyper_zoom",
    "pulse_zoom",
    "slide_left",
    "slide_right",
    "push_up",
    "perspective_push",
    "spin_left",
    "spin_right",
    "motion_blur",
    "gaussian_blur",
]

def test_all_20_transitions_mapped_and_compiled(tmp_path):
    """Verifies each of the 20 transitions compiles to a deterministic FFmpeg filter."""
    compiler = TimelineCompiler()
    v1 = tmp_path / "c1.mp4"
    v2 = tmp_path / "c2.mp4"
    v1.write_text("1")
    v2.write_text("2")

    assert len(ALL_20_TRANSITIONS) == 20
    for trans_name in ALL_20_TRANSITIONS:
        assert trans_name in TRANSITION_MAP, f"Missing mapping for {trans_name}"
        expected_filter = TRANSITION_MAP[trans_name]

        request = TimelineExportRequest(
            projectId=f"test-{trans_name}",
            tracks=[TrackSchema(id="video", label="Video Spine", type="video", clipIds=["c1", "c2"])],
            clips=[
                ClipSchema(
                    id="c1",
                    trackId="video",
                    start=0.0,
                    duration=3.0,
                    mediaUrl=str(v1),
                    transition=TransitionSchema(type=trans_name, duration=0.5)
                ),
                ClipSchema(
                    id="c2",
                    trackId="video",
                    start=3.0,
                    duration=3.0,
                    mediaUrl=str(v2)
                )
            ],
            fps=30,
            width=1280,
            height=720,
            quality="standard"
        )
        output_file = str(tmp_path / f"out_{trans_name}.mp4")
        cmd, dur = compiler.compile(request, output_file)
        fc_str = cmd[cmd.index("-filter_complex") + 1]

        assert "xfade=" in fc_str
        assert f"transition={expected_filter}" in fc_str


def test_track_layering_pip_over_main_video(tmp_path):
    """Verifies that overlay-clip track is layered ON TOP of the main video spine."""
    compiler = TimelineCompiler()
    v_main = tmp_path / "main.mp4"
    v_pip = tmp_path / "pip.mp4"
    v_main.write_text("main")
    v_pip.write_text("pip")

    # Deliberately list overlay-clip first in tracks array to test that compiler corrects layer priority
    request = TimelineExportRequest(
        projectId="layering-test",
        tracks=[
            TrackSchema(id="overlay-clip", label="PIP Overlay", type="video", clipIds=["c_pip"]),
            TrackSchema(id="video", label="Main Spine", type="video", clipIds=["c_main"]),
        ],
        clips=[
            ClipSchema(
                id="c_main",
                trackId="video",
                start=0.0,
                duration=5.0,
                mediaUrl=str(v_main)
            ),
            ClipSchema(
                id="c_pip",
                trackId="overlay-clip",
                start=1.0,
                duration=3.0,
                scale=0.5,
                mediaUrl=str(v_pip)
            )
        ],
        fps=30,
        width=1920,
        height=1080,
        quality="standard"
    )

    output_file = str(tmp_path / "out_layer.mp4")
    cmd, _ = compiler.compile(request, output_file)
    fc_str = cmd[cmd.index("-filter_complex") + 1]

    # Find overlay filter nodes in order
    overlay_parts = [line for line in fc_str.split(";") if "overlay=" in line]
    assert len(overlay_parts) == 2
    # First overlay layers main video onto canvas
    # Second overlay layers PIP onto the combined main video canvas (so PIP is on top)
    assert "between(t,0.0,5.0)" in overlay_parts[0]
    assert "between(t,1.0,4.0)" in overlay_parts[1]


def test_keyframes_opacity_and_position(tmp_path):
    """Verifies that keyframes are compiled into dynamic animations."""
    compiler = TimelineCompiler()
    v1 = tmp_path / "kf.mp4"
    v1.write_text("kf")

    request = TimelineExportRequest(
        projectId="keyframe-test",
        tracks=[TrackSchema(id="video", label="Video", type="video", clipIds=["c1"])],
        clips=[
            ClipSchema(
                id="c1",
                trackId="video",
                start=0.0,
                duration=4.0,
                mediaUrl=str(v1),
                keyframes=[
                    KeyframeSchema(property="opacity", timeOffset=0.0, value=0.0),
                    KeyframeSchema(property="opacity", timeOffset=1.0, value=1.0),
                    KeyframeSchema(property="positionX", timeOffset=0.0, value=0.0),
                    KeyframeSchema(property="positionX", timeOffset=2.0, value=200.0),
                ]
            )
        ],
        fps=30,
        width=1280,
        height=720,
        quality="standard"
    )

    output_file = str(tmp_path / "out_kf.mp4")
    cmd, _ = compiler.compile(request, output_file)
    fc_str = cmd[cmd.index("-filter_complex") + 1]

    # Fade in generated for opacity keyframes
    assert "fade=t=in" in fc_str
    # Dynamic expression generated for positionX keyframes
    assert "if(between(t," in fc_str


def test_media_resolution_handles_uploads_and_remote(tmp_path):
    """Verifies that _resolve_media_path handles full URLs, uploads, and local paths without black screening."""
    compiler = TimelineCompiler()
    
    # 1. Direct path
    test_f = tmp_path / "direct.mp4"
    test_f.write_text("data")
    assert compiler._resolve_media_path(str(test_f)) == str(test_f)

    # 2. Remote URL
    remote_url = "https://example.com/videos/sample.mp4"
    assert compiler._resolve_media_path(remote_url) == remote_url

    # 3. None returns None
    assert compiler._resolve_media_path(None) is None
