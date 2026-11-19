import pytest

from app.engine.compiler import TimelineCompiler
from app.runners.probe_runner import ProbeRunner
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema, EffectSchema


@pytest.mark.parametrize(
    "preset, canvas, factor, rate",
    [("720p", "720x1280", 2 / 3, "8M"), ("4k", "2160x3840", 2, "50M")],
)
def test_preset_scales_editor_positions_and_uses_requested_effect_fps(preset, canvas, factor, rate):
    request = TimelineExportRequest(
        tracks=[TrackSchema(id="video", label="Video", type="video")],
        clips=[
            ClipSchema(
                id="clip",
                trackId="video",
                duration=2,
                scale=0.5,
                positionY=-120,
                keyframes=[
                    {"timeOffset": 0.5, "property": "positionX", "value": -180},
                    {"timeOffset": 1.5, "property": "positionX", "value": 180, "interpolation": "easeIn"},
                ],
                effects=[{"type": "zoom_in"}, {"type": "move_up", "parameters": {"distance": 30}}],
            ),
        ],
        resolutionPreset=preset,
        aspectRatio="9:16",
        fps=60,
    )
    command, _ = TimelineCompiler().compile(request, "output.mp4")
    graph = command[command.index("-filter_complex") + 1]

    assert f"s={canvas}:fps=60" in graph
    assert "on/(2.0*60)" in graph
    assert "if(lte(t,1.5),-180.0+(360.0)*pow(clip((t-0.5)/1.0,0,1),2),180.0)" in graph
    assert f"(H-h)/2+(-120.0)*{float(factor)}" in graph
    assert f"(30.0*max(0,1-(t-0.0)/0.8))*{float(factor)}" in graph
    assert command[command.index("-maxrate") + 1] == rate


def test_preset_scales_plain_pip_once_and_keeps_full_size_for_effects(tmp_path, monkeypatch):
    source = tmp_path / "clip.mp4"
    source.touch()
    monkeypatch.setattr(ProbeRunner, "probe_sync", lambda _: {"streams": []})
    clip = ClipSchema(
        id="pip", trackId="overlay", duration=1, inPoint=1, outPoint=2,
        mediaUrl=str(source), scale=0.5, muted=True,
    )
    request = TimelineExportRequest(
        tracks=[TrackSchema(id="overlay", label="Overlay", type="video")],
        clips=[clip], resolutionPreset="4k", aspectRatio="16:9",
    )
    compiler = TimelineCompiler()
    plain, _ = compiler.compile(request, "output.mp4")
    graph = plain[plain.index("-filter_complex") + 1]
    assert graph.index("trim=start=1.0") < graph.index("scale=")
    assert "pad=w=1920:h=1080" in graph
    assert graph.count("]scale=") == 1

    request.clips[0].effects = [EffectSchema(type="zoom_in")]
    with_effect, _ = compiler.compile(request, "output.mp4")
    graph = with_effect[with_effect.index("-filter_complex") + 1]
    assert "pad=w=3840:h=2160" in graph
    assert "zoompan=" in graph
    assert graph.count("]scale=") == 2


def test_opaque_preset_clips_bypass_redundant_background_overlays():
    request = TimelineExportRequest(
        tracks=[TrackSchema(id="video", label="Video", type="video")],
        clips=[ClipSchema(id="first", trackId="video", duration=2)],
        resolutionPreset="1080p", aspectRatio="16:9",
    )
    compiler = TimelineCompiler()
    command, _ = compiler.compile(request, "output.mp4")
    graph = command[command.index("-filter_complex") + 1]
    assert "tpad=stop_duration=2.0:color=black" in graph
    assert "]overlay=" not in graph

    request.clips.append(ClipSchema(
        id="second", trackId="video", start=1.5, duration=2,
        transition={"type": "cross_dissolve", "duration": 0.5},
    ))
    command, _ = compiler.compile(request, "output.mp4")
    graph = command[command.index("-filter_complex") + 1]
    assert "]xfade=" in graph
    assert graph.count("]overlay=") == 1


def test_compiler_generates_valid_ffmpeg_command(tmp_path):
    compiler = TimelineCompiler()
    
    # Create fake media file
    dummy_video = tmp_path / "dummy.mp4"
    dummy_video.write_text("fake media content")

    request = TimelineExportRequest(
        projectId="proj-test",
        tracks=[
            TrackSchema(id="video", label="Video Spine", type="video", clipIds=["clip-1", "clip-2"])
        ],
        clips=[
            ClipSchema(
                id="clip-1",
                trackId="video",
                name="Intro",
                type="video",
                start=0.0,
                duration=4.0,
                inPoint=1.0,
                outPoint=5.0,
                speed=2.0,
                mediaUrl=str(dummy_video)
            ),
            ClipSchema(
                id="clip-2",
                trackId="video",
                name="Title",
                type="text",
                start=2.0,
                duration=3.0,
                textData={"content": "Welcome to Veytrix", "fontSize": 48}
            )
        ],
        fps=30,
        width=1280,
        height=720,
        quality="standard"
    )

    output_file = str(tmp_path / "output.mp4")
    cmd, duration = compiler.compile(request, output_file)

    assert duration >= 5.0
    assert "-filter_complex" in cmd
    assert "-c:v" in cmd
    assert "libx264" in cmd
    assert output_file in cmd

    # Verify filter complex contains canvas and scale
    filter_complex_idx = cmd.index("-filter_complex") + 1
    fc_str = cmd[filter_complex_idx]
    assert "color=c=black" in fc_str
    assert "1280x720" in fc_str
    assert "setpts" in fc_str  # Speed factor
    assert "overlay=" in fc_str


def test_compiler_timeline_start_pts_offset(tmp_path):
    compiler = TimelineCompiler()
    dummy_video = tmp_path / "dummy.mp4"
    dummy_video.write_text("fake media content")

    request = TimelineExportRequest(
        projectId="proj-pts-test",
        tracks=[TrackSchema(id="video", label="Video", type="video", clipIds=["c1"])],
        clips=[
            ClipSchema(
                id="c1",
                trackId="video",
                name="Delayed Clip",
                type="video",
                start=3.5,
                duration=4.0,
                inPoint=0.0,
                outPoint=4.0,
                mediaUrl=str(dummy_video)
            )
        ],
        fps=30,
        width=1280,
        height=720,
        quality="standard"
    )

    output_file = str(tmp_path / "output.mp4")
    cmd, duration = compiler.compile(request, output_file)
    fc_str = cmd[cmd.index("-filter_complex") + 1]

    # Must contain timeline start PTS offset so frames are not dropped early
    assert "PTS-STARTPTS+(3.5/TB)" in fc_str
    assert "between(t,3.5,7.5)" in fc_str

