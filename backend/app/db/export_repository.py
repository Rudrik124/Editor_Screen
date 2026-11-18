import logging
from typing import Optional, Dict
from pathlib import Path
from app.core.config import settings
from app.db.client import get_supabase
from app.schemas.job import RenderJob, JobStatus

logger = logging.getLogger("veytrix.export_repo")

# In-memory export registry fallback
_local_exports: Dict[str, RenderJob] = {}

class ExportRepository:
    """Manages render job history and links to exports table."""

    @staticmethod
    async def save_export(job: RenderJob) -> None:
        _local_exports[job.id] = job
        client = get_supabase()
        if not client or not job.projectId:
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
                res = client.table("exports").select("*").eq("id", job_id).execute()
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
                        outputFile=str(settings.EXPORT_DIR / f"export_{job_id}.mp4"),
                        outputUrl=row.get("file_url") or f"/api/v1/render/jobs/{job_id}/download",
                        createdAt=row.get("created_at"),
                        updatedAt=row.get("updated_at")
                    )
                    _local_exports[job_id] = recovered_job
                    return recovered_job
            except Exception as e:
                logger.debug(f"Could not load export {job_id} from Supabase: {e}")

        # Check if the output MP4 exists on disk
        target_file = settings.EXPORT_DIR / f"export_{job_id}.mp4"
        if target_file.is_file():
            recovered_job = RenderJob(
                id=job_id,
                projectId="current-project",
                userId="anonymous",
                status=JobStatus.COMPLETED,
                progress=100,
                outputFile=str(target_file),
                outputUrl=f"/api/v1/render/jobs/{job_id}/download",
            )
            _local_exports[job_id] = recovered_job
            return recovered_job

        return None
