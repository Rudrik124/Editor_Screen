import logging
from typing import Optional, Dict
from app.db.client import get_supabase
from app.schemas.job import RenderJob

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
        return _local_exports.get(job_id)
