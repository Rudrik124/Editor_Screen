import shutil
from pathlib import Path
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
async def get_health():
    """Health check endpoint providing system status and verified FFmpeg path."""
    ffmpeg_bin = settings.get_ffmpeg_path()
    ffmpeg_exists = Path(ffmpeg_bin).exists() if ffmpeg_bin else False
    
    total, used, free = shutil.disk_usage(settings.STORAGE_DIR)
    
    return {
        "status": "healthy" if ffmpeg_exists else "degraded",
        "ffmpeg": {
            "binary": ffmpeg_bin,
            "available": ffmpeg_exists
        },
        "storage": {
            "total_gb": round(total / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2)
        }
    }
