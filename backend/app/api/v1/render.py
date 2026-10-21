from pathlib import Path
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.responses import FileResponse
from app.core.dependencies import get_current_user_id
from app.core.security import resolve_safe_path
from app.core.config import settings
from app.db.export_repository import ExportRepository
from app.queue.job_queue import job_queue
from app.queue.connection_manager import ws_manager
from app.schemas.job import RenderJob
from app.schemas.timeline import TimelineExportRequest

router = APIRouter(prefix="/render", tags=["Render"])

@router.post("", response_model=RenderJob)
async def create_render_job(
    request: TimelineExportRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Submits a timeline export request to the asynchronous render queue.
    Returns job metadata including job ID and progress endpoint.
    """
    if not request.clips:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot render an empty timeline with 0 clips."
        )
    return await job_queue.submit_render(request, user_id)

@router.get("/jobs/{job_id}", response_model=RenderJob)
async def get_job_status(job_id: str):
    """Returns current render job status, progress percentage, and output link."""
    job = await ExportRepository.get_export(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Render job '{job_id}' not found."
        )
    return job

@router.get("/jobs/{job_id}/download")
async def download_rendered_video(job_id: str):
    """Serves the rendered MP4 video file safely."""
    job = await ExportRepository.get_export(job_id)
    if not job or not job.outputFile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Render job '{job_id}' not found."
        )

    # Secure sandbox check: ensures path is strictly within EXPORT_DIR
    target = resolve_safe_path(settings.EXPORT_DIR, Path(job.outputFile).name)
    if not target.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rendered video file is not ready or does not exist."
        )

    return FileResponse(
        path=str(target),
        media_type="video/mp4",
        filename=f"veytrix_render_{job_id[:8]}.mp4"
    )

@router.websocket("/jobs/{job_id}/ws")
async def websocket_render_progress(websocket: WebSocket, job_id: str):
    """Streams live real-time progress events (0-100%) to connected frontend clients."""
    await ws_manager.connect(job_id, websocket)
    try:
        # Keep connection open until client disconnects
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(job_id, websocket)
    except Exception:
        ws_manager.disconnect(job_id, websocket)
