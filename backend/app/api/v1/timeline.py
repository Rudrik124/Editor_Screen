from fastapi import APIRouter, Depends, HTTPException, status
from app.core.dependencies import get_current_user_id
from app.db.timeline_repository import TimelineRepository
from app.schemas.persistence import TimelineSaveRequest, TimelineLoadResponse

router = APIRouter(prefix="/timeline", tags=["Timeline Persistence"])

@router.post("/save")
async def save_timeline_state(
    request: TimelineSaveRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Auto-saves or manually saves the full timeline graph (tracks, clips, keyframes).
    Enables user to stop editing anytime and resume without loss of work.
    """
    success = await TimelineRepository.save_timeline(request, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save timeline state"
        )
    return {
        "status": "saved",
        "projectId": request.projectId,
        "clipCount": len(request.clips),
        "trackCount": len(request.tracks)
    }

@router.get("/{project_id}", response_model=TimelineLoadResponse)
async def load_timeline_state(
    project_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Loads saved project timeline graph so editing can resume right where user left off.
    """
    state = await TimelineRepository.load_timeline(project_id, user_id)
    if not state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Timeline for project '{project_id}' not found"
        )
    return state
