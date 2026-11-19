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
from app.engine.models import RenderWatermark
from app.runners.ffmpeg_runner import FFmpegRunner
from app.runners.export_probe import verify_export
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
        user_id: str,
        watermark: RenderWatermark | None = None,
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
        output_path = ExportRepository.output_path(job_id, request.resolutionPreset)

        job = RenderJob(
            id=job_id,
            projectId=request.projectId,
            userId=user_id,
            status=JobStatus.PENDING,
            progress=0,
            createdAt=now,
            updatedAt=now
        )
        await ExportRepository.save_export(job, persist=False)

        # Track active user render
        self._active_user_jobs[user_id] = active_count + 1

        # Spawn asynchronous render background task
        asyncio.create_task(self._process_render(job, request, str(output_path), user_id, watermark))
        return job

    async def _process_render(
        self,
        job: RenderJob,
        request: TimelineExportRequest,
        output_filepath: str,
        user_id: str,
        watermark: RenderWatermark | None,
    ):
        async with self._semaphore:
            job.status = JobStatus.PROCESSING
            job.updatedAt = datetime.now(timezone.utc).isoformat()
            await ws_manager.broadcast(job.id, ProgressMessage(
                jobId=job.id, status=job.status, progress=0
            ).model_dump())

            output_path = Path(output_filepath)
            temporary_path = output_path.with_suffix(".pending.mp4")
            try:
                # 1. Compile timeline into FFmpeg arguments
                cmd, duration = await asyncio.to_thread(self._compiler.compile, request, str(temporary_path), watermark)
                job.durationSeconds = duration

                # 2. Progress callback passed to FFmpegRunner
                async def on_progress(pct: int, frame: Optional[int], fps: Optional[float]):
                    job.progress = max(job.progress, min(pct, 99))
                    job.currentFrame = frame
                    job.fps = fps
                    job.updatedAt = datetime.now(timezone.utc).isoformat()
                    await ws_manager.broadcast(job.id, ProgressMessage(
                        jobId=job.id, status=job.status, progress=job.progress, currentFrame=frame, fps=fps
                    ).model_dump())

                # 3. Execute subprocess
                await FFmpegRunner.run(
                    cmd=cmd,
                    total_duration_seconds=duration,
                    progress_callback=on_progress,
                    timeout_seconds=settings.MAX_RENDER_TIMEOUT_SECONDS
                )

                await asyncio.to_thread(verify_export, temporary_path, request.width, request.height, request.fps)
                temporary_path.replace(output_path)
                job.outputFile = str(output_path)
                job.outputUrl = f"/api/v1/render/jobs/{job.id}/download"
                job.status = JobStatus.COMPLETED
                job.progress = 100
                job.updatedAt = datetime.now(timezone.utc).isoformat()
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
                await ws_manager.broadcast(job.id, ProgressMessage(
                    jobId=job.id, status=job.status, progress=job.progress, error=str(e)
                ).model_dump())

            finally:
                try:
                    temporary_path.unlink(missing_ok=True)
                except OSError:
                    logger.warning("Could not remove temporary export for job %s", job.id, exc_info=True)
                # Decrement active user renders
                current = self._active_user_jobs.get(user_id, 1)
                self._active_user_jobs[user_id] = max(0, current - 1)

        # Remote history must not occupy an encoder slot or delay the terminal event.
        await ExportRepository.save_export(job)

job_queue = JobQueue()
