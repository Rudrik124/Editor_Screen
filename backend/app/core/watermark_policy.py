from datetime import datetime, timezone
import logging
from uuid import UUID

from fastapi import HTTPException

from app.core.config import settings
from app.core.dependencies import DEV_GUEST_USER_ID
from app.core.watermark_assets import resolve_custom_watermark, resolve_official_watermark
from app.db.client import get_supabase
from app.engine.models import RenderWatermark
from app.schemas.timeline import WatermarkExportSettings

logger = logging.getLogger(__name__)


def can_customize_watermark(user_id: str) -> bool:
    if not settings.WATERMARK_SUBSCRIPTIONS_ENABLED:
        return True
    if user_id == DEV_GUEST_USER_ID:
        return False
    try:
        UUID(user_id)
    except ValueError:
        return False

    client = get_supabase()
    if client is None:
        raise HTTPException(503, "Watermark entitlement verification is unavailable")
    try:
        result = (
            client.table("watermark_entitlements")
            .select("user_id")
            .eq("user_id", user_id)
            .gt("premium_until", datetime.now(timezone.utc).isoformat())
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception as error:
        logger.warning("Watermark entitlement lookup failed", exc_info=True)
        raise HTTPException(503, "Watermark entitlement verification is unavailable") from error


def resolve_render_watermark(
    preferences: WatermarkExportSettings | None, user_id: str
) -> RenderWatermark | None:
    if not can_customize_watermark(user_id):
        return RenderWatermark(path=resolve_official_watermark(), x=1, y=1, width=0.15, opacity=0.85)
    if preferences is None or not preferences.enabled:
        return None
    if preferences.source == "custom":
        if preferences.assetId is None:
            raise HTTPException(422, "Select a custom watermark asset")
        path = resolve_custom_watermark(preferences.assetId, user_id)
    else:
        path = resolve_official_watermark()

    return RenderWatermark(
        path=path,
        x=preferences.x,
        y=preferences.y,
        width=preferences.width,
        opacity=preferences.opacity,
    )
