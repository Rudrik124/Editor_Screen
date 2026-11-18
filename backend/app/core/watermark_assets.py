import json
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException

from app.core.config import settings


WATERMARK_ASSET_TYPE = "watermark"


def resolve_official_watermark() -> Path:
    path = settings.OFFICIAL_WATERMARK_PATH
    if not path.is_file():
        raise HTTPException(503, "Official watermark is unavailable")
    return path


def resolve_custom_watermark(asset_id: UUID, owner: str) -> Path:
    manifest = settings.STORAGE_DIR / "asset_owners" / f"{asset_id}.json"
    filename = f"{asset_id}_watermark.png"
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = None

    if (
        not isinstance(data, dict)
        or data.get("owner") != owner
        or data.get("type") != WATERMARK_ASSET_TYPE
        or data.get("filename") != filename
    ):
        raise HTTPException(404, "Watermark asset not found")

    upload_dir = settings.UPLOAD_DIR.resolve()
    path = (upload_dir / filename).resolve()
    if not path.is_relative_to(upload_dir) or not path.is_file():
        raise HTTPException(404, "Watermark asset not found")
    return path
