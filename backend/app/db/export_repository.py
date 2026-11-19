import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict
from pathlib import Path
from app.core.config import settings
from app.db.client import get_supabase
from app.schemas.job import RenderJob, JobStatus

logger = logging.getLogger("veytrix.export_repo")

# In-memory export registry fallback
_local_exports: Dict[str, RenderJob] = {}
EXPORT_PRESETS = ("720p", "1080p", "4k")

class ExportRepository:
    """Manages render job history and links to exports table."""

    @staticmethod
    def output_path(job_id: str, preset: Optional[str] = None) -> Path:
        suffix = f"_{preset}" if preset in EXPORT_PRESETS else ""
        return settings.EXPORT_DIR / f"export_{job_id}{suffix}.mp4"

    @staticmethod
    def download_filename(job_id: str, target: Path) -> str:
        for preset in EXPORT_PRESETS:
            if target.name == ExportRepository.output_path(job_id, preset).name:
                return f"veytrix_render_{preset}_export.mp4"
        return f"veytrix_render_{job_id[:8]}.mp4"

    @staticmethod
    def _find_output(job_id: str) -> Path:
        for preset in EXPORT_PRESETS:
            path = ExportRepository.output_path(job_id, preset)
            if path.is_file():
                return path
        return ExportRepository.output_path(job_id)

    @staticmethod
    async def save_export(job: RenderJob, *, persist: bool = True) -> None:
        _local_exports[job.id] = job
        if persist and job.projectId:
            await asyncio.to_thread(ExportRepository._persist_export, job.model_copy())

    @staticmethod
    def _persist_export(job: RenderJob) -> None:
        client = get_supabase()
        if not client:
            return

        try:
            client.table("exports").upsert({
                "id": job.id,
                "project_id": job.projectId,
                "user_id": job.userId,
                "status": job.status.value.lower(),
                "file_url": job.outputUrl,
                "created_at": job.createdAt,
                "updated_at": job.updatedAt
            }).execute()
        except Exception as e:
            logger.warning(f"Could not sync export {job.id} to Supabase: {e}")

    @staticmethod
    async def get_export(job_id: str) -> Optional[RenderJob]:
        job = _local_exports.get(job_id)
        if job:
            return job

        client = get_supabase()
        if client:
            try:
                res = await asyncio.to_thread(client.table("exports").select("*").eq("id", job_id).execute)
                if res.data and len(res.data) > 0:
                    row = res.data[0]
                    status_str = str(row.get("status") or "").upper()
                    status_enum = JobStatus.COMPLETED if status_str == "COMPLETED" else (
                        JobStatus.FAILED if status_str == "FAILED" else JobStatus.PROCESSING
                    )
                    recovered_job = RenderJob(
                        id=row["id"],
                        projectId=row.get("project_id", "current-project"),
                        userId=row.get("user_id", "anonymous"),
                        status=status_enum,
                        progress=100 if status_enum == JobStatus.COMPLETED else 0,
                        outputFile=str(ExportRepository._find_output(job_id)),
                        outputUrl=row.get("file_url") or f"/api/v1/render/jobs/{job_id}/download",
                        createdAt=row.get("created_at"),
                        updatedAt=row.get("updated_at")
                    )
                    _local_exports[job_id] = recovered_job
                    return recovered_job
            except Exception as e:
                logger.debug(f"Could not load export {job_id} from Supabase: {e}")

        # Check if the output MP4 exists on disk
        target_file = ExportRepository._find_output(job_id)
        if target_file.is_file():
            timestamp = datetime.fromtimestamp(target_file.stat().st_mtime, timezone.utc).isoformat()
            recovered_job = RenderJob(
                id=job_id,
                projectId="current-project",
                userId="anonymous",
                status=JobStatus.COMPLETED,
                progress=100,
                outputFile=str(target_file),
                outputUrl=f"/api/v1/render/jobs/{job_id}/download",
                createdAt=timestamp,
                updatedAt=timestamp,
            )
            _local_exports[job_id] = recovered_job
            return recovered_job

        return None
