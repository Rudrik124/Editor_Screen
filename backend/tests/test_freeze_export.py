import pytest
from pathlib import Path
import subprocess

from app.core.config import settings
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema

def test_freeze_clip_export_not_black(tmp_path):
    ffmpeg_bin = settings.get_ffmpeg_path()
    src_video = tmp_path / "src.mp4"
    out_video = tmp_path / "out.mp4"

    # Create 6-second test video
    subprocess.run([
        ffmpeg_bin, "-y",
        "-f", "lavfi", "-i", "testsrc=duration=6:size=320x240:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=800:duration=6",
        "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p",
        str(src_video)
    ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # 3 sequential clips:
    # 1. Normal clip: 0.0 -> 2.0s
    # 2. Freeze clip: 2.0 -> 4.0s (freeze at 2.0s)
    # 3. Resumed clip: 4.0 -> 6.0s (resumed from 2.0 to 4.0s)
    req = TimelineExportRequest(
        projectId="freeze-test",
        tracks=[TrackSchema(id="t1", label="Video", type="video", clipIds=["c1", "c2", "c3"])],
        clips=[
            ClipSchema(id="c1", trackId="t1", name="Part1", type="video", start=0.0, duration=2.0, inPoint=0.0, outPoint=2.0, mediaUrl=str(src_video)),
            ClipSchema(id="c2", trackId="t1", name="Freeze", type="video", start=2.0, duration=2.0, inPoint=2.0, outPoint=2.0, isFrozen=True, freezeTime=2.0, mediaUrl=str(src_video)),
            ClipSchema(id="c3", trackId="t1", name="Part2", type="video", start=4.0, duration=2.0, inPoint=2.0, outPoint=4.0, mediaUrl=str(src_video)),
        ],
        fps=30, width=320, height=240, quality="draft"
    )

    compiler = TimelineCompiler()
    cmd, dur = compiler.compile(req, str(out_video))
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert res.returncode == 0, f"FFmpeg failed: {res.stderr}"

    # Extract frame during freeze at t = 3.0s
    frame_freeze = tmp_path / "freeze_frame.png"
    subprocess.run([ffmpeg_bin, "-y", "-ss", "3.0", "-i", str(out_video), "-vframes", "1", str(frame_freeze)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # A 320x240 solid black image is ~600 bytes. A real rendered test pattern is > 5,000 bytes.
    freeze_size = frame_freeze.stat().st_size
    assert freeze_size > 3000, f"Freeze frame is black! Size is only {freeze_size} bytes"
