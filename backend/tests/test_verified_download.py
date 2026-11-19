import asyncio
import subprocess
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import render
from app.core.config import settings
from app.db import export_repository
from app.queue.job_queue import JobQueue
from app.runners.ffmpeg_runner import FFmpegRunner
from app.schemas.job import JobStatus


@pytest.mark.parametrize("preset", ["720p", "1080p", "4k"])
def test_recovered_export_download_uses_preset_filename(tmp_path, monkeypatch, preset):
    monkeypatch.setattr(settings, "EXPORT_DIR", tmp_path)
    monkeypatch.setattr(export_repository, "get_supabase", lambda: None)
    job_id = f"recovery-{preset}"
    (tmp_path / f"export_{job_id}_{preset}.mp4").write_bytes(b"published export")
    app = FastAPI()
    app.include_router(render.router)
    response = TestClient(app).get(f"/render/jobs/{job_id}/download")
    assert response.status_code == 200
    assert response.headers["content-disposition"] == f'attachment; filename="veytrix_render_{preset}_export.mp4"'


@pytest.mark.parametrize("outcome", ["verified", "mismatch", "encoder_failure"])
def test_only_verified_mp4_is_published(tmp_path, monkeypatch, outcome):
    monkeypatch.setattr(settings, "EXPORT_DIR", tmp_path)
    monkeypatch.setattr(export_repository, "get_supabase", lambda: None)
    app = FastAPI()
    app.include_router(render.router, prefix="/api/v1")
    app.dependency_overrides[render.get_current_user_id] = lambda: "export-test"

    source = tmp_path / "source.mp4"
    subprocess.run(
        [settings.get_ffmpeg_path(), "-y", "-loglevel", "error", "-f", "lavfi",
         "-i", "testsrc2=size=320x240:rate=30:duration=0.5",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(source)],
        check=True, capture_output=True,
    )
    tracks = [
        {"id": "video", "label": "Video", "type": "video"},
        {"id": "overlay", "label": "Overlay", "type": "video"},
        {"id": "text", "label": "Text", "type": "text"},
    ]
    base = {"trackId": "video", "duration": 0.5, "mediaUrl": str(source)}
    clips = [
        {**base, "id": "first", "transition": {"type": "cross_dissolve", "duration": 0.2}},
        {**base, "id": "second", "start": 0.3},
        {**base, "id": "pip", "trackId": "overlay", "scale": 0.4, "positionX": 100},
        {"id": "title", "trackId": "text", "type": "text", "duration": 0.8,
         "textData": {"content": "Portrait export", "fontSize": 48, "referenceWidth": 1080}},
    ]

    async def run():
        monkeypatch.setattr(render, "job_queue", JobQueue())
        render_finished = asyncio.Event()
        allow_verification = asyncio.Event()
        encode = FFmpegRunner.run

        async def controlled_encode(**kwargs):
            temporary_path = Path(kwargs["cmd"][-1])
            assert temporary_path.name.endswith(".pending.mp4")
            if outcome == "verified":
                await encode(**kwargs)
            else:
                temporary_path.write_bytes(source.read_bytes())
                await kwargs["progress_callback"](100, None, None)
            render_finished.set()
            await allow_verification.wait()
            if outcome == "encoder_failure":
                raise RuntimeError("Encoder failed after writing output")
            return True

        monkeypatch.setattr(FFmpegRunner, "run", controlled_encode)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post("/api/v1/render", json={
                "tracks": tracks, "clips": clips, "resolutionPreset": "4k", "aspectRatio": "9:16", "fps": 60,
            })
            assert created.status_code == 200, created.text
            job_url = f"/api/v1/render/jobs/{created.json()['id']}"
            assert created.json()["outputUrl"] is None

            try:
                await asyncio.wait_for(render_finished.wait(), timeout=45)
                processing = (await client.get(job_url)).json()
                assert processing["status"] == JobStatus.PROCESSING
                assert processing["progress"] == 99
                assert (await client.get(f"{job_url}/download")).status_code == 404
                assert (tmp_path / f"export_{created.json()['id']}_4k.pending.mp4").is_file()
                assert not (tmp_path / f"export_{created.json()['id']}_4k.mp4").exists()
            finally:
                allow_verification.set()

            async with asyncio.timeout(10):
                while True:
                    job = (await client.get(job_url)).json()
                    if job["status"] in (JobStatus.COMPLETED, JobStatus.FAILED):
                        break
                    await asyncio.sleep(0.02)
            download = await client.get(f"{job_url}/download")
            assert not list(tmp_path.glob("*.pending.mp4"))
            if outcome == "verified":
                assert job["status"] == JobStatus.COMPLETED, job.get("error")
                assert job["progress"] == 100
                assert download.status_code == 200
                assert download.headers["content-type"] == "video/mp4"
                assert download.headers["content-disposition"] == 'attachment; filename="veytrix_render_4k_export.mp4"'
                assert download.content == Path(job["outputFile"]).read_bytes()
            else:
                assert job["status"] == JobStatus.FAILED
                assert job["outputUrl"] is None
                assert download.status_code == 404
                assert not list(tmp_path.glob("export_*.mp4"))
                expected_error = "Export settings mismatch" if outcome == "mismatch" else "Encoder failed"
                assert expected_error in job["error"]

    asyncio.run(run())
