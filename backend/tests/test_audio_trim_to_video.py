import subprocess
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema
from app.runners.probe_runner import ProbeRunner

def test_audio_longer_than_video_is_trimmed_to_video_length(tmp_path):
    """
    Verifies that when video is 3.0s and audio is 6.0s (longer than video),
    the compiled timeline total_duration is clamped to 3.0s,
    the audio is trimmed to 3.0s, and the export ends cleanly at 3.0s with no blank gap.
    """
    compiler = TimelineCompiler()
    req = TimelineExportRequest(
        projectId="audio-longer-than-video-test",
        tracks=[
            TrackSchema(id="video", label="Video Spine", type="video", clipIds=["v1"]),
            TrackSchema(id="audio", label="BGM Audio", type="audio", clipIds=["a1"])
        ],
        clips=[
            # Video is 3 seconds long
            ClipSchema(
                id="v1", trackId="video", name="Scene 1", type="video",
                start=0.0, duration=3.0, inPoint=0.0, outPoint=3.0,
                mediaUrl="storage/test_user_sim.mp4"
            ),
            # Audio is 6 seconds long (starts at 0.0, extends to 6.0)
            ClipSchema(
                id="a1", trackId="audio", name="Background Music", type="audio",
                start=0.0, duration=6.0, inPoint=0.0, outPoint=6.0,
                mediaUrl="storage/test_user_sim.mp4"
            )
        ],
        fps=30, width=640, height=360, quality="draft"
    )

    out_video = tmp_path / "clamped_export.mp4"
    cmd, dur = compiler.compile(req, str(out_video))

    # Duration must be 3.0s, NOT 6.0s
    assert dur == 3.0

    res = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert res.returncode == 0, f"FFmpeg failed: {res.stderr}"
    assert out_video.exists()

    meta = ProbeRunner.probe_sync(str(out_video))
    out_dur = float(meta["format"]["duration"])
    # Video must end at ~3.0s (not 6.0s)
    assert abs(out_dur - 3.0) < 0.2

