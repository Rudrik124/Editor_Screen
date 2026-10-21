import asyncio
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional
from fastapi import HTTPException, status
from app.core.config import settings
from app.db.export_repository import ExportRepository
from app.engine.compiler import TimelineCompiler
from app.runners.ffmpeg_runner import FFmpegRunner
from app.schemas.job import RenderJob, JobStatus, ProgressMessage
from app.schemas.timeline import TimelineExportRequest
from app.queue.connection_manager import ws_manager

logger = logging.getLogger("veytrix.job_queue")

class JobQueue:
    """Multi-user asynchronous job queue with concurrency limits and progress streaming."""

    def __init__(self):
        self._semaphore = asyncio.Semaphore(settings.GLOBAL_MAX_CONCURRENT_RENDERS)
        self._active_user_jobs: Dict[str, int] = {}
        self._compiler = TimelineCompiler()

    async def submit_render(
        self,
        request: TimelineExportRequest,
        user_id: str
    ) -> RenderJob:
        # 1. Enforce per-user concurrency quota
        active_count = self._active_user_jobs.get(user_id, 0)
        if active_count >= settings.MAX_CONCURRENT_RENDERS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Render quota exceeded: maximum {settings.MAX_CONCURRENT_RENDERS_PER_USER} concurrent exports allowed."
            )

        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        output_filename = f"export_{job_id}.mp4"
        output_path = settings.EXPORT_DIR / output_filename
        output_url = f"/api/v1/render/jobs/{job_id}/download"

        job = RenderJob(
            id=job_id,
            projectId=request.projectId,
            userId=user_id,
            status=JobStatus.PENDING,
            progress=0,
            outputFile=str(output_path),
            outputUrl=output_url,
            createdAt=now,
            updatedAt=now
        )
        await ExportRepository.save_export(job)

        # Track active user render
        self._active_user_jobs[user_id] = active_count + 1

        # Spawn asynchronous render background task
        asyncio.create_task(self._process_render(job, request, str(output_path), user_id))
        return job

    async def _process_render(
        self,
        job: RenderJob,
        request: TimelineExportRequest,
        output_filepath: str,
        user_id: str
    ):
        async with self._semaphore:
            job.status = JobStatus.PROCESSING
            job.updatedAt = datetime.now(timezone.utc).isoformat()
            await ExportRepository.save_export(job)
            await ws_manager.broadcast(job.id, ProgressMessage(
                jobId=job.id, status=job.status, progress=0
            ).model_dump())

            try:
                # 1. Compile timeline into FFmpeg arguments
                cmd, duration = self._compiler.compile(request, output_filepath)
                job.durationSeconds = duration

                # 2. Progress callback passed to FFmpegRunner
                async def on_progress(pct: int, frame: Optional[int], fps: Optional[float]):
                    job.progress = pct
                    job.currentFrame = frame
                    job.fps = fps
                    job.updatedAt = datetime.now(timezone.utc).isoformat()
                    await ExportRepository.save_export(job)
                    await ws_manager.broadcast(job.id, ProgressMessage(
                        jobId=job.id, status=job.status, progress=pct, currentFrame=frame, fps=fps
                    ).model_dump())

                # 3. Execute subprocess
                await FFmpegRunner.run(
                    cmd=cmd,
                    total_duration_seconds=duration,
                    progress_callback=on_progress,
                    timeout_seconds=settings.MAX_RENDER_TIMEOUT_SECONDS
                )

                job.status = JobStatus.COMPLETED
                job.progress = 100
                job.updatedAt = datetime.now(timezone.utc).isoformat()
                await ExportRepository.save_export(job)
                await ws_manager.broadcast(job.id, ProgressMessage(
                    jobId=job.id, status=job.status, progress=100
                ).model_dump())
                logger.info(f"Render job {job.id} completed successfully.")

            except Exception as e:
                error_message = str(e).strip() or repr(e) or type(e).__name__
                logger.error(f"Render job {job.id} failed: {error_message}", exc_info=True)
                job.status = JobStatus.FAILED
                job.error = error_message
                job.updatedAt = datetime.now(timezone.utc).isoformat()
                await ExportRepository.save_export(job)
                await ws_manager.broadcast(job.id, ProgressMessage(
                    jobId=job.id, status=job.status, progress=job.progress, error=str(e)
                ).model_dump())

            finally:
                # Decrement active user renders
                current = self._active_user_jobs.get(user_id, 1)
                self._active_user_jobs[user_id] = max(0, current - 1)

job_queue = JobQueue()
