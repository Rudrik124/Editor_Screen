import asyncio
import subprocess
from io import BytesIO

import pytest
from PIL import Image, ImageChops

from app.api.v1 import render
from app.core.config import settings
from app.engine.compiler import TimelineCompiler
from app.engine.models import RenderWatermark
from app.queue.job_queue import JobQueue
from app.schemas.job import JobStatus
from app.schemas.timeline import TimelineExportRequest


def run_ffmpeg(command):
    result = subprocess.run(command, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr.decode(errors="replace")
    return result.stdout


@pytest.mark.parametrize("mode, size", [
    ("official", (320, 240)),
    ("custom", (320, 480)),
    ("disabled", (320, 240)),
    ("omitted", (320, 240)),
])
def test_watermark_in_encoded_frames(tmp_path, mode, size):
    width, height = size
    source = tmp_path / "black.png"
    Image.new("RGB", size).save(source)
    logo = tmp_path / "custom.png"
    image = Image.new("RGBA", (40, 20), (255, 255, 255, 0))
    image.paste((255, 255, 255, 255), (20, 0, 40, 20))
    image.save(logo)

    custom = mode == "custom"
    enabled = mode in {"official", "custom"}
    preferences = {
        "enabled": enabled,
        "source": "custom" if custom else "official",
        "assetId": "427fe346-4e4e-4081-81e7-9d472b1a6fd6" if custom else None,
        "x": 0.2 if custom else 1,
        "y": 0.25 if custom else 1,
        "width": 0.3,
        "opacity": 0.5 if custom else 0.85,
    }
    request = TimelineExportRequest(
        width=width, height=height, fps=10, quality="high",
        tracks=[{"id": "video", "label": "Video", "type": "video", "clipIds": ["bg"]}],
        clips=[{"id": "bg", "trackId": "video", "name": "Background", "type": "image",
                "mediaUrl": str(source), "start": 0, "duration": 1}],
        watermark=preferences if mode != "omitted" else None,
    )
    resolved = None
    if enabled:
        resolved = RenderWatermark(
            logo if custom else settings.OFFICIAL_WATERMARK_PATH,
            preferences["x"], preferences["y"], preferences["width"], preferences["opacity"],
        )
    output = tmp_path / "export.mp4"
    command, duration = TimelineCompiler().compile(request, str(output), resolved)
    assert duration == 1
    run_ffmpeg(command)

    frames = run_ffmpeg([
        command[0], "-v", "error", "-i", str(output), "-map", "0:v:0",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ])
    frame_bytes = width * height * 3
    assert len(frames) == 10 * frame_bytes
    audio = run_ffmpeg([command[0], "-v", "error", "-i", str(output), "-map", "0:a:0",
                        "-f", "s16le", "pipe:1"])
    assert audio

    for index in (0, 5, 9):
        frame = Image.frombytes("RGB", size, frames[index * frame_bytes:(index + 1) * frame_bytes])
        if custom:
            assert max(frame.getpixel((80, 135))) < 10  # Transparent half
            assert all(110 <= channel <= 145 for channel in frame.getpixel((135, 135)))
            assert max(frame.getpixel((160, 135))) < 10  # Outside the logo
        else:
            difference = ImageChops.difference(frame, Image.new("RGB", size))
            if enabled:
                assert max(difference.crop((215, 135, 315, 237)).getextrema()[0]) > 30
                assert max(difference.crop((0, 0, 200, 125)).getextrema()[0]) < 10
            else:
                assert max(difference.getextrema()[0]) < 10


def test_missing_or_invalid_watermark_fails_compilation(tmp_path):
    request = TimelineExportRequest(
        tracks=[],
        clips=[{"id": "a", "trackId": "audio", "name": "Audio", "type": "audio",
                "start": 0, "duration": 1}],
    )
    logo = tmp_path / "logo.png"
    watermark = RenderWatermark(logo, 1, 1, 0.15, 1)
    compiler = TimelineCompiler()
    with pytest.raises(ValueError, match="watermark image is missing or invalid"):
        compiler.compile(request, "export.mp4", watermark)
    logo.write_bytes(b"invalid PNG")
    with pytest.raises(ValueError, match="watermark image is missing or invalid"):
        compiler.compile(request, "export.mp4", watermark)


@pytest.mark.asyncio
async def test_render_submission_queues_watermark_and_serves_mp4(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "EXPORT_DIR", tmp_path)
    monkeypatch.setattr(render, "job_queue", JobQueue())
    monkeypatch.setattr("app.db.export_repository.get_supabase", lambda: None)
    source = tmp_path / "source.png"
    Image.new("RGB", (320, 240)).save(source)
    request = TimelineExportRequest(
        width=320, height=240, fps=10,
        tracks=[{"id": "video", "label": "Video", "type": "video", "clipIds": ["image"]}],
        clips=[{"id": "image", "trackId": "video", "name": "Image", "type": "image",
                "mediaUrl": str(source), "start": 0, "duration": 1}],
        watermark={"enabled": True, "source": "official", "x": 1, "y": 1, "width": 0.3, "opacity": 1},
    )
    job = await render.create_render_job(request, "watermark-test-user")
    request.watermark.opacity = 0

    async with asyncio.timeout(30):
        while job.status in {JobStatus.PENDING, JobStatus.PROCESSING}:
            await asyncio.sleep(0.02)
    assert job.status == JobStatus.COMPLETED, job.error
    response = await render.download_rendered_video(job.id)
    png = run_ffmpeg([
        settings.get_ffmpeg_path(), "-v", "error", "-i", response.path,
        "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1",
    ])
    with Image.open(BytesIO(png)) as frame:
        assert frame.crop((215, 135, 315, 237)).getextrema()[0][1] > 30
