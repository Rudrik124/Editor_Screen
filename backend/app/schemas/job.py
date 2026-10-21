from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class JobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class RenderJob(BaseModel):
    id: str
    projectId: Optional[str] = None
    userId: str
    status: JobStatus = JobStatus.PENDING
    progress: int = Field(default=0, ge=0, le=100)
    currentFrame: Optional[int] = 0
    fps: Optional[float] = 0.0
    outputFile: Optional[str] = None
    outputUrl: Optional[str] = None
    error: Optional[str] = None
    createdAt: str
    updatedAt: str
    durationSeconds: Optional[float] = None

class ProgressMessage(BaseModel):
    type: str = "progress"
    jobId: str
    status: JobStatus
    progress: int
    currentFrame: Optional[int] = None
    fps: Optional[float] = None
    error: Optional[str] = None
