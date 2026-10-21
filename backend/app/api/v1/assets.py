import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.core.config import settings
from app.core.security import sanitize_filename, validate_file_extension
from app.runners.probe_runner import ProbeRunner

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    """
    Accepts media file upload, validates extension, sanitizes filename,
    and returns asset metadata for timeline placement.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    ext = validate_file_extension(file.filename)
    safe_name = sanitize_filename(file.filename)
    asset_id = str(uuid.uuid4())
    stored_filename = f"{asset_id}_{safe_name}"
    target_path = settings.UPLOAD_DIR / stored_filename

    # Stream in chunks (prevent memory spike)
    chunk_size = 1024 * 1024  # 1 MB
    bytes_read = 0
    with open(target_path, "wb") as buffer:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            bytes_read += len(chunk)
            if bytes_read > settings.MAX_UPLOAD_SIZE_BYTES:
                target_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)}MB)"
                )
            buffer.write(chunk)

    # Probe file
    probe_info = await ProbeRunner.probe(str(target_path))

    return {
        "assetId": asset_id,
        "filename": safe_name,
        "mediaUrl": f"/uploads/{stored_filename}",
        "localPath": str(target_path),
        "sizeBytes": bytes_read,
        "probe": probe_info
    }
