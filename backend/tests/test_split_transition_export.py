import subprocess
from pathlib import Path
import pytest
from app.core.config import settings
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema, TransitionSchema

@pytest.fixture(scope="module")
def synthetic_video(tmp_path_factory):
    ffmpeg_bin = settings.get_ffmpeg_path()
    fn = tmp_path_factory.mktemp("media") / "split_src.mp4"
    subprocess.run([
        ffmpeg_bin, "-y",
        "-f", "lavfi", "-i", "testsrc=duration=5:size=640x360:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=1000:duration=5",
        "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p",
        str(fn)
    ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return str(fn)

def test_split_and_transition_on_c1(tmp_path, synthetic_video):
    request = TimelineExportRequest(
        projectId="split-trans-c1",
        tracks=[TrackSchema(id="video", label="Spine", type="video", clipIds=["c1", "c2"])],
        clips=[
            ClipSchema(
                id="c1",
                trackId="video",
                start=0.0,
                duration=2.0,
                inPoint=0.0,
                outPoint=2.0,
                mediaUrl=synthetic_video,
                transition=TransitionSchema(type="cross_dissolve", duration=0.5)
            ),
            ClipSchema(
                id="c2",
                trackId="video",
                start=2.0,
                duration=3.0,
                inPoint=2.0,
                outPoint=5.0,
                mediaUrl=synthetic_video
            )
        ],
        fps=30,
        width=640,
        height=360,
        quality="draft"
    )

    compiler = TimelineCompiler()
    out_video = tmp_path / "out_c1.mp4"
    cmd, duration = compiler.compile(request, str(out_video))
    fc_str = cmd[cmd.index("-filter_complex") + 1]

    assert "xfade=transition=fade" in fc_str
    assert "offset=1.500" in fc_str
    assert duration == 4.5  # 2.0 + 3.0 - 0.5 = 4.5s

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert res.returncode == 0, f"FFmpeg failed: {res.stderr}"
    assert out_video.exists()


def test_split_transition_on_c2_is_applied(tmp_path, synthetic_video):
    """Verifies that if transition is set on c2 (incoming split clip), it is compiled seamlessly."""
    request = TimelineExportRequest(
        projectId="split-trans-c2",
        tracks=[TrackSchema(id="video", label="Spine", type="video", clipIds=["c1", "c2"])],
        clips=[
            ClipSchema(
                id="c1",
                trackId="video",
                start=0.0,
                duration=2.0,
                inPoint=0.0,
                outPoint=2.0,
                mediaUrl=synthetic_video
            ),
            ClipSchema(
                id="c2",
                trackId="video",
                start=2.0,
                duration=3.0,
                inPoint=2.0,
                outPoint=5.0,
                mediaUrl=synthetic_video,
                transition=TransitionSchema(type="cross_dissolve", duration=0.6)
            )
        ],
        fps=30,
        width=640,
        height=360,
        quality="draft"
    )

    compiler = TimelineCompiler()
    out_video = tmp_path / "out_c2.mp4"
    cmd, duration = compiler.compile(request, str(out_video))
    fc_str = cmd[cmd.index("-filter_complex") + 1]

    assert "xfade=transition=fade" in fc_str
    assert "duration=0.600" in fc_str
    assert "offset=1.400" in fc_str
    assert duration == 4.4  # 2.0 + 3.0 - 0.6 = 4.4s

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert res.returncode == 0, f"FFmpeg failed: {res.stderr}"
    assert out_video.exists()


def test_split_instant_cut_uses_clean_concat(tmp_path, synthetic_video):
    """Verifies that instant_cut compiles to clean concat with zero duration artifact."""
    request = TimelineExportRequest(
        projectId="split-instant-cut",
        tracks=[TrackSchema(id="video", label="Spine", type="video", clipIds=["c1", "c2"])],
        clips=[
            ClipSchema(
                id="c1",
                trackId="video",
                start=0.0,
                duration=2.0,
                inPoint=0.0,
                outPoint=2.0,
                mediaUrl=synthetic_video,
                transition=TransitionSchema(type="instant_cut", duration=0.0)
            ),
            ClipSchema(
                id="c2",
                trackId="video",
                start=2.0,
                duration=3.0,
                inPoint=2.0,
                outPoint=5.0,
                mediaUrl=synthetic_video
            )
        ],
        fps=30,
        width=640,
        height=360,
        quality="draft"
    )

    compiler = TimelineCompiler()
    out_video = tmp_path / "out_cut.mp4"
    cmd, duration = compiler.compile(request, str(out_video))
    fc_str = cmd[cmd.index("-filter_complex") + 1]

    # Instant cut should use concat, not xfade
    assert "concat=n=2:v=1:a=0" in fc_str
    assert duration == 5.0  # 2.0 + 3.0 = 5.0s exactly

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert res.returncode == 0, f"FFmpeg failed: {res.stderr}"
    assert out_video.exists()
