import uuid
import json
from io import BytesIO
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from fastapi.responses import FileResponse
from PIL import Image
from app.core.config import settings
from app.core.dependencies import get_current_user_id
from app.core.security import sanitize_filename, validate_file_extension
from app.core.watermark_assets import WATERMARK_ASSET_TYPE, resolve_official_watermark
from app.core.watermark_policy import can_customize_watermark
from app.runners.probe_runner import ProbeRunner

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("/watermarks/official")
def official_watermark():
    return FileResponse(resolve_official_watermark(), media_type="image/png")


@router.post("/watermarks", status_code=status.HTTP_201_CREATED)
def upload_watermark(file: UploadFile = File(...), owner: str = Depends(get_current_user_id)):
    if not can_customize_watermark(owner):
        raise HTTPException(403, "Custom watermarks require Premium")
    data = file.file.read(settings.MAX_WATERMARK_UPLOAD_BYTES + 1)
    if len(data) > settings.MAX_WATERMARK_UPLOAD_BYTES:
        raise HTTPException(413, "Watermark exceeds the upload size limit")

    try:
        with Image.open(BytesIO(data), formats=["PNG"]) as image:
            width, height = image.size
            if max(width, height) > settings.MAX_WATERMARK_DIMENSION:
                raise HTTPException(422, "Watermark dimensions exceed the image limit")
            if getattr(image, "is_animated", False):
                raise HTTPException(422, "Choose a still PNG watermark")
            image.verify()
        with Image.open(BytesIO(data), formats=["PNG"]) as image:
            normalized = image.convert("RGBA")
            normalized.info.clear()
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as error:
        raise HTTPException(422, "Choose a valid PNG watermark") from error

    asset_id = uuid.uuid4()
    filename = f"{asset_id}_watermark.png"
    target = settings.UPLOAD_DIR / filename
    manifest = settings.STORAGE_DIR / "asset_owners" / f"{asset_id}.json"
    try:
        manifest.parent.mkdir(parents=True, exist_ok=True)
        normalized.save(target, format="PNG")
        manifest.write_text(
            json.dumps({"owner": owner, "filename": filename, "type": WATERMARK_ASSET_TYPE}),
            encoding="utf-8",
        )
    except OSError:
        target.unlink(missing_ok=True)
        manifest.unlink(missing_ok=True)
        raise

    return {
        "assetId": str(asset_id),
        "previewUrl": f"/uploads/{filename}",
        "width": width,
        "height": height,
    }


@router.post("/upload")
async def upload_asset(file: UploadFile = File(...), owner: str = Depends(get_current_user_id)):
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

    owners = settings.STORAGE_DIR / "asset_owners"
    owners.mkdir(parents=True, exist_ok=True)
    (owners / f"{asset_id}.json").write_text(json.dumps({"owner": owner, "filename": stored_filename}))

    return {
        "assetId": asset_id,
        "filename": safe_name,
        "mediaUrl": f"/uploads/{stored_filename}",
        "localPath": str(target_path),
        "sizeBytes": bytes_read,
        "probe": probe_info
    }
