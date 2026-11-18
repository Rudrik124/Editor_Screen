"""Bounded, owner-scoped reverse previews. Original assets remain unchanged."""
import asyncio
import json
import logging
import math
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, model_validator
from app.core.config import settings
from app.core.dependencies import get_current_user_id

router = APIRouter(prefix="/preview", tags=["Preview"])
jobs: dict[str, dict] = {}
tasks: set[asyncio.Task] = set()
MAX_SECONDS = 600
TTL = 1800


class ReverseRequest(BaseModel):
    assetId: uuid.UUID
    start: float = Field(ge=0, allow_inf_nan=False)
    end: float = Field(gt=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_range(self):
        if not 0 < self.end - self.start <= MAX_SECONDS:
            raise ValueError("Select a source range of at most 10 minutes")
        return self


def resolve_asset(asset_id: uuid.UUID, user_id: str) -> Path:
    manifest = settings.STORAGE_DIR / "asset_owners" / f"{asset_id}.json"
    if manifest.exists():
        data = json.loads(manifest.read_text())
        if data["owner"] != user_id:
            raise HTTPException(404, "Asset not found")
        source = settings.UPLOAD_DIR / Path(data["filename"]).name
    elif settings.ENVIRONMENT == "development":
        # Legacy local uploads predate owner manifests.
        matches = list(settings.UPLOAD_DIR.glob(f"{asset_id}_*"))
        if len(matches) != 1:
            raise HTTPException(404, "Upload the source again to prepare reverse")
        source = matches[0]
    else:
        raise HTTPException(404, "Asset not found")
    if not source.is_file() or not source.resolve().is_relative_to(settings.UPLOAD_DIR.resolve()):
        raise HTTPException(404, "Asset not found")
    return source


def prune():
    now = time.monotonic()
    for job_id, job in list(jobs.items()):
        if now - job["touched"] > TTL and job["status"] in ("Completed", "Failed", "Cancelled"):
            shutil.rmtree(job["directory"], ignore_errors=True)
            del jobs[job_id]
    root = settings.STORAGE_DIR / "previews"
    active_directories = {job["directory"] for job in jobs.values()}
    if root.exists():
        for directory in root.iterdir():
            if directory.is_dir() and directory not in active_directories and time.time() - directory.stat().st_mtime > TTL:
                shutil.rmtree(directory, ignore_errors=True)


async def cleanup_loop():
    while True:
        prune()
        await asyncio.sleep(60)


def owned_job(job_id: str, owner: str):
    prune()
    job = jobs.get(job_id)
    if not job or job["owner"] != owner:
        raise HTTPException(404, "Preview not found")
    job["touched"] = time.monotonic()
    return job


def public_job(job):
    return {key: job[key] for key in ("id", "status", "progress", "error")}


def generate(job, source: Path, request: ReverseRequest):
    directory = job["directory"]
    directory.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + settings.MAX_RENDER_TIMEOUT_SECONDS

    def run(args):
        with (directory / "ffmpeg.log").open("wb") as diagnostics:
            process = subprocess.Popen([settings.get_ffmpeg_path(), "-nostdin", "-y", "-v", "error", *args],
                                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=diagnostics, cwd=directory)
            try:
                while process.poll() is None:
                    if job["cancel"].wait(0.1):
                        raise InterruptedError("Preview cancelled")
                    if time.monotonic() > deadline:
                        raise TimeoutError("Reverse preparation timed out")
                if process.returncode:
                    raise RuntimeError((directory / "ffmpeg.log").read_text(errors="replace")[-2000:])
            finally:
                if process.poll() is None:
                    process.kill()
                process.wait()

    try:
        if job["cancel"].is_set():
            raise InterruptedError()
        job.update(status="Processing", progress=1)
        duration = request.end - request.start
        count = math.ceil(duration / 4)
        # Four-second chunks bound reverse-filter memory even for long-GOP sources.
        for index in range(count):
            end = request.end - index * 4
            start = max(request.start, end - 4)
            run(["-ss", str(start), "-t", str(end - start + 1 / 30), "-i", str(source),
                 "-map", "0:v:0", "-an", "-vf",
                 f"scale=w='trunc(min(1280,iw)/2)*2':h='trunc(min(720,ih)/2)*2',fps=30,trim=duration={end - start},reverse,setpts=PTS-STARTPTS",
                 "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p", "-threads", "2",
                 str(directory / f"part{index}.mp4")])
            job["progress"] = min(94, int((index + 1) / count * 94))
        job.update(status="Finalizing", progress=95)
        listing = directory / "parts.txt"
        listing.write_text("".join(f"file 'part{i}.mp4'\n" for i in range(count)))
        run(["-f", "concat", "-safe", "1", "-i", listing.name, "-c", "copy", "-movflags", "+faststart", str(directory / "preview.mp4")])
        if job["cancel"].is_set():
            raise InterruptedError()
        job.update(status="Completed", progress=100)
    except InterruptedError:
        job.update(status="Cancelled", error="Preview cancelled")
    except Exception:
        logging.getLogger(__name__).exception("Reverse preview preparation failed")
        job.update(status="Failed", error="Reverse preparation failed. Retry or use a shorter source range.")
    finally:
        for file in directory.glob("*"):
            if file.name != "preview.mp4" or job["status"] != "Completed":
                file.unlink(missing_ok=True)
        job["touched"] = time.monotonic()


@router.post("/reverse")
async def reverse_preview(request: ReverseRequest, owner: str = Depends(get_current_user_id)):
    source = resolve_asset(request.assetId, owner)
    prune()
    key = (owner, str(request.assetId), source.stat().st_mtime_ns, request.start, request.end)
    for job in jobs.values():
        if job["key"] == key and job["status"] not in ("Failed", "Cancelled"):
            job["touched"] = time.monotonic()
            return public_job(job)
    active = [j for j in jobs.values() if j["status"] in ("Queued", "Processing", "Finalizing")]
    if len(active) >= settings.GLOBAL_MAX_CONCURRENT_RENDERS or sum(j["owner"] == owner for j in active) >= settings.MAX_CONCURRENT_RENDERS_PER_USER:
        raise HTTPException(429, "Reverse preparation is busy. Retry shortly.")
    # Bound cached disk usage as well as active work.
    completed = sorted((j for j in jobs.values() if j["status"] not in ("Queued", "Processing", "Finalizing")), key=lambda j: j["touched"])
    for old in completed[:max(0, len(jobs) - 15)]:
        shutil.rmtree(old["directory"], ignore_errors=True)
        del jobs[old["id"]]
    job_id = str(uuid.uuid4())
    job = dict(id=job_id, owner=owner, key=key, status="Queued", progress=0, error=None,
               directory=settings.STORAGE_DIR / "previews" / job_id, cancel=threading.Event(), touched=time.monotonic())
    jobs[job_id] = job
    task = asyncio.create_task(asyncio.to_thread(generate, job, source, request))
    tasks.add(task)
    task.add_done_callback(tasks.discard)
    return public_job(job)


@router.get("/{job_id}")
async def status(job_id: str, owner: str = Depends(get_current_user_id)):
    return public_job(owned_job(job_id, owner))


@router.delete("/{job_id}")
async def cancel(job_id: str, owner: str = Depends(get_current_user_id)):
    job = owned_job(job_id, owner)
    if job["status"] in ("Queued", "Processing", "Finalizing"):
        job["cancel"].set()
    return public_job(job)


@router.get("/{job_id}/media")
async def media(job_id: str, owner: str = Depends(get_current_user_id)):
    job = owned_job(job_id, owner)
    if job["status"] != "Completed":
        raise HTTPException(409, "Preview is not ready")
    return FileResponse(job["directory"] / "preview.mp4", media_type="video/mp4")
