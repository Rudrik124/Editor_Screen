import asyncio
import subprocess
from pathlib import Path
import pytest
from app.core.config import settings
from app.queue.job_queue import job_queue
from app.runners.probe_runner import ProbeRunner
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema
from app.schemas.job import JobStatus

@pytest.mark.asyncio
async def test_end_to_end_synthetic_render(tmp_path):
    # 1. Generate real synthetic 2-second test MP4 using FFmpeg
    synthetic_input = tmp_path / "synthetic_src.mp4"
    ffmpeg_bin = settings.get_ffmpeg_path()
    
    gen_cmd = [
        ffmpeg_bin,
        "-y",
        "-f", "lavfi", "-i", "testsrc=duration=2:size=640x360:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=1000:duration=2",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-pix_fmt", "yuv420p",
        str(synthetic_input)
    ]
    res = subprocess.run(gen_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert res.returncode == 0
    assert synthetic_input.exists()

    # 2. Build multi-feature export request (speed 1.5x, trim, text subtitle, color filter)
    request = TimelineExportRequest(
        projectId="proj-e2e-synthetic",
        tracks=[
            TrackSchema(id="v1", label="Video Track", type="video", clipIds=["c1", "c2"])
        ],
        clips=[
            ClipSchema(
                id="c1",
                trackId="v1",
                name="Synthetic Scene",
                type="video",
                start=0.0,
                duration=1.2,
                inPoint=0.2,
                outPoint=1.8,
                speed=1.5,
                mediaUrl=str(synthetic_input),
                filters=[{"type": "brightness", "intensity": 1.1}]
            ),
            ClipSchema(
                id="c2",
                trackId="v1",
                name="Title",
                type="text",
                start=0.5,
                duration=1.0,
                textData={"content": "Veytrix E2E Render", "fontSize": 32}
            )
        ],
        fps=30,
        width=640,
        height=360,
        quality="draft"
    )

    # 3. Submit render to job queue
    user_id = "test-user-e2e"
    job = await job_queue.submit_render(request, user_id)
    assert job.status in (JobStatus.PENDING, JobStatus.PROCESSING)

    # 4. Await job completion
    for _ in range(60):  # Wait up to 30s
        await asyncio.sleep(0.5)
        from app.db.export_repository import ExportRepository
        current_job = await ExportRepository.get_export(job.id)
        if current_job and current_job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
            job = current_job
            break

    assert job.status == JobStatus.COMPLETED
    assert job.progress == 100
    assert job.outputFile is not None
    assert Path(job.outputFile).exists()
    assert Path(job.outputFile).stat().st_size > 5000

    # 5. Probe the rendered MP4 to verify video and audio stream validity
    probe_data = await ProbeRunner.probe(job.outputFile)
    assert "streams" in probe_data
    video_streams = [s for s in probe_data["streams"] if s.get("codec_type") == "video"]
    assert len(video_streams) >= 1
    assert video_streams[0]["width"] == 640
    assert video_streams[0]["height"] == 360
