from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.timeline import TrackSchema, ClipSchema

class TimelineSaveRequest(BaseModel):
    projectId: str
    title: Optional[str] = "Untitled Project"
    tracks: List[TrackSchema]
    clips: List[ClipSchema]
    playheadTime: float = Field(default=0.0, ge=0.0)
    duration: float = Field(default=0.0, ge=0.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class TimelineLoadResponse(BaseModel):
    projectId: str
    title: str
    tracks: List[TrackSchema]
    clips: List[ClipSchema]
    playheadTime: float
    duration: float
    updatedAt: Optional[str] = None
