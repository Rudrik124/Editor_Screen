import json
import subprocess
import threading
import time
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.api.v1 import preview
from app.core.config import settings
from app.core.dependencies import get_current_user_id
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import ClipSchema, TrackSchema, TimelineExportRequest


def run(args):
    result = subprocess.run([settings.get_ffmpeg_path(), "-nostdin", "-y", "-v", "error", *args], capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr.decode(errors="replace")[-2000:]
    return result.stdout


def job(directory):
    return dict(id=str(uuid.uuid4()), owner="alice", directory=directory, status="Queued", progress=0,
                cancel=threading.Event(), error=None, touched=time.monotonic())


def test_reverse_real_frames_across_chunk_boundary(tmp_path):
    source = tmp_path / "source.mp4"
    run(["-f", "lavfi", "-i", "nullsrc=s=160x90:r=30:d=5,geq=lum='16+N':cb=128:cr=128", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(source)])
    current = job(tmp_path / "preview")
    preview.generate(current, source, preview.ReverseRequest(assetId=uuid.uuid4(), start=0, end=5))
    assert current["status"] == "Completed", current
    frames = run(["-i", str(current["directory"] / "preview.mp4"), "-vf", "scale=1:1,format=gray", "-f", "rawvideo", "pipe:1"])
    assert 149 <= len(frames) <= 151
    assert frames[0] > frames[-1] + 100
    assert all(b <= a + 2 for a, b in zip(frames, frames[1:])), list(frames)
    assert list(current["directory"].iterdir()) == [current["directory"] / "preview.mp4"]


def test_cancel_and_failure_remove_partial_outputs(tmp_path):
    current = job(tmp_path / "cancelled")
    current["cancel"].set()
    preview.generate(current, tmp_path / "missing.mp4", preview.ReverseRequest(assetId=uuid.uuid4(), start=0, end=2))
    assert current["status"] in ("Cancelled", "Failed")
    assert not list(current["directory"].iterdir())


def test_asset_and_job_ownership_and_range_validation(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(settings, "UPLOAD_DIR", tmp_path / "uploads")
    settings.UPLOAD_DIR.mkdir()
    asset = uuid.uuid4()
    (tmp_path / "asset_owners").mkdir()
    (tmp_path / "asset_owners" / f"{asset}.json").write_text(json.dumps({"owner": "alice", "filename": f"{asset}_source.mp4"}))
    (settings.UPLOAD_DIR / f"{asset}_source.mp4").write_bytes(b"media")
    assert preview.resolve_asset(asset, "alice").exists()
    with pytest.raises(HTTPException):
        preview.resolve_asset(asset, "bob")
    current = job(tmp_path / "private")
    monkeypatch.setitem(preview.jobs, current["id"], current)
    with pytest.raises(HTTPException):
        preview.owned_job(current["id"], "bob")
    for start, end in [(0, 601), (5, 1), (float("nan"), 3)]:
        with pytest.raises(ValidationError):
            preview.ReverseRequest(assetId=asset, start=start, end=end)


def test_production_auth_fails_closed(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as error:
        get_current_user_id(None)
    assert error.value.status_code == 401
    monkeypatch.setattr(settings, "JWT_SECRET", "")
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    with pytest.raises(HTTPException) as error:
        get_current_user_id("Bearer invalid")
    assert error.value.status_code == 503


@pytest.mark.parametrize("content", ["NEON", "O'Brien: 50% [x]; text"] )
def test_neon_export_is_real_and_preserves_background(tmp_path, content):
    source = tmp_path / "red#source.mp4"
    run(["-f", "lavfi", "-i", "color=red:s=640x360:r=30:d=1", "-c:v", "libx264", str(source)])
    request = TimelineExportRequest(width=640, height=360, quality="draft", tracks=[
        TrackSchema(id="video", label="Video", type="video", clipIds=["v"]),
        TrackSchema(id="text", label="Text", type="text", clipIds=["t"]),
    ], clips=[ClipSchema(id="v", trackId="video", type="video", duration=1, mediaUrl=str(source)),
        ClipSchema(id="t", trackId="text", type="text", duration=1, textData={"content": content, "fontSize": 48, "x": 20, "y": 20, "preset": "neon", "color": "#00ffff"})])
    output = tmp_path / "neon.mp4"
    command, _ = TimelineCompiler().compile(request, str(output))
    assert "gblur" in command[command.index("-filter_complex") + 1]
    result = subprocess.run(command, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr.decode(errors="replace")[-3000:]
    pixels = run(["-i", str(output), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"])
    corner = pixels[(350 * 640 + 630) * 3: (350 * 640 + 630) * 3 + 3]
    assert corner[0] > 200 and corner[1] < 40 and corner[2] < 40, list(corner)
    assert any(pixels[i + 1] > 150 and pixels[i + 2] > 150 for i in range(0, len(pixels), 3))
