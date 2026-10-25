import pytest
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import (
    TimelineExportRequest,
    TrackSchema,
    ClipSchema,
    TransitionSchema,
)
from app.engine.plugins.transitions import TRANSITION_MAP

def test_compiler_generates_xfade_for_contiguous_transition(tmp_path):
    compiler = TimelineCompiler()
    v1 = tmp_path / "clip1.mp4"
    v2 = tmp_path / "clip2.mp4"
    v1.write_text("media 1")
    v2.write_text("media 2")

    request = TimelineExportRequest(
        projectId="phase3-trans-test",
        tracks=[
            TrackSchema(id="video", label="Video Spine", type="video", clipIds=["c1", "c2"])
        ],
        clips=[
            ClipSchema(
                id="c1",
                trackId="video",
                name="Intro",
                type="video",
                start=0.0,
                duration=4.0,
                mediaUrl=str(v1),
                transition=TransitionSchema(type="cross_dissolve", duration=0.8)
            ),
            ClipSchema(
                id="c2",
                trackId="video",
                name="Scene 2",
                type="video",
                start=4.0,
                duration=4.0,
                mediaUrl=str(v2)
            )
        ],
        fps=30,
        width=1280,
        height=720,
        quality="standard"
    )

    output_file = str(tmp_path / "out_trans.mp4")
    cmd, duration = compiler.compile(request, output_file)
    fc_str = cmd[cmd.index("-filter_complex") + 1]

    # Verify xfade is present
    assert "xfade=" in fc_str
    assert "transition=fade" in fc_str
    assert "duration=0.800" in fc_str
    # offset = 4.0 - 0.8 = 3.2s
    assert "offset=3.200" in fc_str


def test_compiler_supports_all_20_transitions(tmp_path):
    compiler = TimelineCompiler()
    v1 = tmp_path / "c1.mp4"
    v2 = tmp_path / "c2.mp4"
    v1.write_text("1")
    v2.write_text("2")

    for trans_name, expected_ffmpeg in TRANSITION_MAP.items():
        request = TimelineExportRequest(
            projectId=f"test-{trans_name}",
            tracks=[TrackSchema(id="video", label="Video", type="video", clipIds=["c1", "c2"])],
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
        cmd, _ = compiler.compile(request, output_file)
        fc_str = cmd[cmd.index("-filter_complex") + 1]

        assert f"transition={expected_ffmpeg}" in fc_str, f"Failed mapping for {trans_name}"
        assert "xfade=" in fc_str


def test_compiler_generates_pip_scale_and_opacity(tmp_path):
    compiler = TimelineCompiler()
    bg = tmp_path / "bg.mp4"
    pip = tmp_path / "pip.mp4"
    bg.write_text("bg")
    pip.write_text("pip")

    request = TimelineExportRequest(
        projectId="pip-test",
        tracks=[
            TrackSchema(id="video", label="Spine", type="video", clipIds=["c_bg"]),
            TrackSchema(id="overlay-clip", label="PIP", type="video", clipIds=["c_pip"])
        ],
        clips=[
            ClipSchema(
                id="c_bg",
                trackId="video",
                start=0.0,
                duration=6.0,
                mediaUrl=str(bg)
            ),
            ClipSchema(
                id="c_pip",
                trackId="overlay-clip",
                start=1.0,
                duration=4.0,
                mediaUrl=str(pip),
                scale=0.4,
                opacity=0.85,
                positionX=250.0,
                positionY=150.0
            )
        ],
        fps=30,
        width=1280,
        height=720,
        quality="standard"
    )

    output_file = str(tmp_path / "out_pip.mp4")
    cmd, _ = compiler.compile(request, output_file)
    fc_str = cmd[cmd.index("-filter_complex") + 1]

    # Check scaled PIP: 1280 * 0.4 = 512
    assert "scale=w=512:h=-1" in fc_str
    # Check opacity: colorchannelmixer
    assert "colorchannelmixer=aa=0.85" in fc_str
    # Check overlay coordinates
    assert "x=250:y=150" in fc_str
    assert "between(t,1.0,5.0)" in fc_str
