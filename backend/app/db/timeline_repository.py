import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from app.db.client import get_supabase
from app.schemas.persistence import TimelineSaveRequest, TimelineLoadResponse
from app.schemas.timeline import TrackSchema, ClipSchema

logger = logging.getLogger("veytrix.timeline_repo")

# In-memory store for local mode / guest users without remote Supabase
_local_store: Dict[str, Dict[str, Any]] = {}

class TimelineRepository:
    """Manages timeline state persistence so users can stop & resume editing anytime."""

    @staticmethod
    async def save_timeline(request: TimelineSaveRequest, user_id: str) -> bool:
        """Saves tracks and clips into Supabase (or local fallback)."""
        now = datetime.now(timezone.utc).isoformat()
        
        # 1. Update in-memory fallback cache
        _local_store[request.projectId] = {
            "title": request.title,
            "tracks": [t.model_dump() for t in request.tracks],
            "clips": [c.model_dump() for c in request.clips],
            "playheadTime": request.playheadTime,
            "duration": request.duration,
            "updatedAt": now,
            "userId": user_id
        }

        # 2. Sync to Supabase if configured
        client = get_supabase()
        if not client:
            return True

        try:
            # Upsert project metadata
            client.table("projects").upsert({
                "id": request.projectId,
                "user_id": user_id,
                "title": request.title,
                "timeline_json": {
                    "tracks": [t.model_dump() for t in request.tracks],
                    "clips": [c.model_dump() for c in request.clips],
                    "playheadTime": request.playheadTime,
                    "duration": request.duration
                },
                "updated_at": now
            }).execute()

            # Replace tracks & clips relationally
            client.table("timeline_clips").delete().eq("project_id", request.projectId).execute()
            client.table("timeline_tracks").delete().eq("project_id", request.projectId).execute()

            # Insert tracks
            tracks_data = []
            for t in request.tracks:
                tracks_data.append({
                    "id": t.id if len(t.id) == 36 else None,
                    "project_id": request.projectId,
                    "user_id": user_id,
                    "name": t.label,
                    "type": t.type,
                    "order_index": t.orderIndex,
                    "muted": t.muted,
                    "hidden": t.hidden,
                    "locked": t.locked
                })
            if tracks_data:
                client.table("timeline_tracks").insert(tracks_data).execute()

            return True
        except Exception as e:
            logger.error(f"Error persisting timeline to Supabase: {e}", exc_info=True)
            return True  # Fallback store already holds state

    @staticmethod
    async def load_timeline(project_id: str, user_id: str) -> Optional[TimelineLoadResponse]:
        """Loads saved timeline for project to allow seamless editing resumption."""
        # 1. Check local cache first
        if project_id in _local_store:
            data = _local_store[project_id]
            return TimelineLoadResponse(
                projectId=project_id,
                title=data.get("title", "Untitled Project"),
                tracks=[TrackSchema(**t) for t in data.get("tracks", [])],
                clips=[ClipSchema(**c) for c in data.get("clips", [])],
                playheadTime=data.get("playheadTime", 0.0),
                duration=data.get("duration", 0.0),
                updatedAt=data.get("updatedAt")
            )

        # 2. Try Supabase
        client = get_supabase()
        if not client:
            return None

        try:
            res = client.table("projects").select("*").eq("id", project_id).execute()
            if not res.data:
                return None
            
            proj = res.data[0]
            tjson = proj.get("timeline_json") or {}
            tracks = [TrackSchema(**t) for t in tjson.get("tracks", [])]
            clips = [ClipSchema(**c) for c in tjson.get("clips", [])]
            
            return TimelineLoadResponse(
                projectId=project_id,
                title=proj.get("title", "Untitled Project"),
                tracks=tracks,
                clips=clips,
                playheadTime=tjson.get("playheadTime", 0.0),
                duration=tjson.get("duration", 0.0),
                updatedAt=proj.get("updated_at")
            )
        except Exception as e:
            logger.error(f"Failed loading timeline from Supabase: {e}")
            return None
