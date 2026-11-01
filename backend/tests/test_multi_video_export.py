import subprocess
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema
from app.runners.probe_runner import ProbeRunner

def test_two_adjacent_videos_export_seamlessly(tmp_path):
    """Tests that two adjacent video clips on the video track compile and export without gap."""
    compiler = TimelineCompiler()
    # Create two adjacent 2-second synthetic color clips
    req = TimelineExportRequest(
        projectId="multi-video-test",
        tracks=[TrackSchema(id="video", label="Video", type="video", clipIds=["v1", "v2"])],
        clips=[
            ClipSchema(
                id="v1", trackId="video", name="V1", type="video",
                start=0.0, duration=2.5, inPoint=0.0, outPoint=2.5
            ),
            ClipSchema(
                id="v2", trackId="video", name="V2", type="video",
                start=2.5, duration=3.0, inPoint=0.0, outPoint=3.0
            )
        ],
        fps=30, width=640, height=360, quality="draft"
    )
    out_video = tmp_path / "seamless_out.mp4"
    cmd, dur = compiler.compile(req, str(out_video))
    assert dur == 5.5
    res = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert res.returncode == 0, f"FFmpeg failed: {res.stderr}"
    assert out_video.exists()

    meta = ProbeRunner.probe_sync(str(out_video))
    out_dur = float(meta["format"]["duration"])
    assert abs(out_dur - 5.5) < 0.2
