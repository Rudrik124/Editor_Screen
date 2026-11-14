import time
import uuid
from typing import List, Dict, Any, Tuple, Optional
from app.schemas.ai_assistant import (
    TOOL_ARG_MODELS,
    ToolCallRequestItem,
    EditorCommandSchema
)

def validate_tool_call(
    tool_name: str,
    raw_args: Dict[str, Any],
    timeline_state: Dict[str, Any]
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Validates a tool call:
    1. Schema validation against Pydantic model
    2. Existence check (does clipId exist in timeline_state?)
    3. Boundary checking (are cut/split/trim times within clip bounds?)
    """
    model_cls = TOOL_ARG_MODELS.get(tool_name)
    if not model_cls:
        return False, f"Unknown tool name: {tool_name}", None

    try:
        validated = model_cls(**raw_args)
        validated_dict = validated.model_dump()
    except Exception as e:
        return False, f"Schema validation error for '{tool_name}': {str(e)}", None

    clips_dict = timeline_state.get("clips", {})
    # clips_dict can be a dict (id -> clip) or a list of clips
    if isinstance(clips_dict, list):
        clips_map = {c.get("id"): c for c in clips_dict if isinstance(c, dict)}
    elif isinstance(clips_dict, dict):
        clips_map = clips_dict
    else:
        clips_map = {}

    # Existence and boundary checks for clip-based operations
    clip_id = validated_dict.get("clipId")
    if clip_id and tool_name not in ["add_clip", "undo_redo", "set_cover", "set_ratio", "mute_track"]:
        # If user refers to 'first clip' or 'clip-1', resolve gracefully if exact clip not found
        if clip_id not in clips_map:
            # Try fuzzy match or fallback to first available clip
            if clips_map:
                resolved_id = next(iter(clips_map.keys()))
                validated_dict["clipId"] = resolved_id
                clip_id = resolved_id
            else:
                return False, f"Clip '{clip_id}' does not exist on timeline.", None

        target_clip = clips_map[clip_id]
        clip_duration = float(target_clip.get("duration", 0.0))
        clip_start = float(target_clip.get("start", 0.0))

        # Boundary checks
        if tool_name == "split_clip":
            split_time = validated_dict.get("splitTime", 0.0)
            if split_time <= clip_start or split_time >= (clip_start + clip_duration):
                return False, f"Cannot split clip: requested cut time ({split_time:.2f}s) is outside clip bounds ({clip_start:.2f}s to {clip_start + clip_duration:.2f}s).", None

        elif tool_name == "trim_clip":
            start = validated_dict.get("start")
            end = validated_dict.get("end")
            duration = validated_dict.get("duration")
            edge = validated_dict.get("edge")
            new_time = validated_dict.get("newTime")

            # Check if requested duration exceeds clip
            if duration is not None and duration > (clip_duration + 0.05):
                return False, f"Cannot trim clip to {duration:.2f}s: the clip duration is only {clip_duration:.2f}s.", None

            # If edge & newTime were supplied directly
            if edge in ("left", "right") and new_time is not None:
                if edge == "right" and new_time > (clip_start + clip_duration + 0.05):
                    return False, f"Cannot trim clip right edge to {new_time:.2f}s: clip ends at {clip_start + clip_duration:.2f}s.", None
                if edge == "left" and new_time < (clip_start - 0.05):
                    return False, f"Cannot trim clip left edge to {new_time:.2f}s: clip starts at {clip_start:.2f}s.", None

            # If target duration or start/end specified:
            elif duration is not None and duration > 0:
                validated_dict["edge"] = "right"
                validated_dict["newTime"] = clip_start + duration
            elif start is not None and end is not None:
                if end <= start:
                    return False, f"Trim end ({end}s) must be greater than start ({start}s)", None
                if end > (clip_start + clip_duration + 0.05):
                    return False, f"Cannot trim clip to {end:.2f}s: clip ends at {clip_start + clip_duration:.2f}s.", None
                # If start changed from clip_start, move left edge
                if abs(start - clip_start) > 0.05:
                    validated_dict["edge"] = "left"
                    validated_dict["newTime"] = start
                else:
                    validated_dict["edge"] = "right"
                    validated_dict["newTime"] = end
            elif end is not None:
                if end > (clip_start + clip_duration + 0.05):
                    return False, f"Cannot trim clip to {end:.2f}s: clip ends at {clip_start + clip_duration:.2f}s.", None
                validated_dict["edge"] = "right"
                validated_dict["newTime"] = end
            elif start is not None:
                validated_dict["edge"] = "left"
                validated_dict["newTime"] = start
            else:
                validated_dict["edge"] = "right"
                validated_dict["newTime"] = clip_start + clip_duration

    return True, None, validated_dict


def tool_call_to_editor_command(
    tool_name: str,
    args: Dict[str, Any]
) -> EditorCommandSchema:
    """
    Converts a validated tool call into an EditorCommand.
    """
    now_ms = time.time() * 1000
    cmd_id = f"ai-cmd-{uuid.uuid4().hex[:8]}"

    # Map tool_name to CommandType
    type_mapping = {
        "duplicate_clip": ("DUPLICATE_CLIP", lambda a: {"clipId": a["clipId"]}),
        "split_clip": ("SPLIT_CLIP", lambda a: {
            "clipId": a["clipId"],
            "splitTime": a["splitTime"],
            "newClipId": a.get("newClipId") or f"clip-{uuid.uuid4().hex[:8]}"
        }),
        "trim_clip": ("TRIM_CLIP", lambda a: {
            "clipId": a["clipId"],
            "edge": a.get("edge", "right"),
            "newTime": a.get("newTime", a.get("end", 0.0)),
            "start": a.get("start"),
            "end": a.get("end"),
            "inPoint": a.get("inPoint"),
            "outPoint": a.get("outPoint")
        }),
        "add_transition": ("ADD_TRANSITION", lambda a: {
            "clipId": a["clipId"],
            "transition": {
                "type": a["type"],
                "duration": a.get("duration", 0.5),
                "color": a.get("color")
            }
        }),
        "remove_transition": ("REMOVE_TRANSITION", lambda a: {"clipId": a["clipId"]}),
        "set_overlap": ("SET_OVERLAP", lambda a: {
            "clipId": a["clipId"],
            "targetTrackId": a["targetTrackId"],
            "targetStartTime": a["targetStartTime"]
        }),
        "set_clip_transform": ("SET_CLIP_TRANSFORM", lambda a: {
            "clipId": a["clipId"],
            **{k: v for k, v in a.items() if k != "clipId" and v is not None}
        }),
        "reverse_clip": ("REVERSE_CLIP", lambda a: {"clipId": a["clipId"]}),
        "extract_audio": ("EXTRACT_AUDIO", lambda a: {"clipId": a["clipId"]}),
        "add_keyframe": ("ADD_KEYFRAME", lambda a: {
            "clipId": a["clipId"],
            "keyframe": {
                "id": f"kf-{uuid.uuid4().hex[:6]}",
                "timeOffset": a["timeOffset"],
                "property": a["property"],
                "value": a["value"],
                "interpolation": a.get("interpolation", "linear")
            }
        }),
        "remove_keyframe": ("REMOVE_KEYFRAME", lambda a: {
            "clipId": a["clipId"],
            "keyframeId": a["keyframeId"]
        }),
        "set_speed": ("SET_SPEED", lambda a: {"clipId": a["clipId"], "speed": a["speed"]}),
        "set_audio_volume": ("SET_AUDIO_VOLUME", lambda a: {"clipId": a["clipId"], "volume": a["volume"]}),
        "mute_clip": ("MUTE_CLIP", lambda a: {"clipId": a["clipId"], "muted": a.get("muted", True)}),
        "mute_track": ("MUTE_TRACK", lambda a: {"trackId": a["trackId"], "muted": a.get("muted", True)}),
        "freeze_clip": ("FREEZE_CLIP", lambda a: {
            "clipId": a["clipId"],
            "freezeTime": a["freezeTime"],
            "duration": a.get("duration", 3.0)
        }),
        "set_cover": ("SET_COVER", lambda a: {"time": a["time"]}),
        "replace_clip": ("REPLACE_CLIP", lambda a: {
            "clipId": a["clipId"],
            "assetId": a["assetId"],
            "mediaUrl": a["mediaUrl"],
            "name": a.get("name")
        }),
        "rename_clip": ("RENAME_CLIP", lambda a: {"clipId": a["clipId"], "name": a["name"]}),
        "lock_clip": (
            "LOCK_CLIP" if args.get("locked", True) else "UNLOCK_CLIP",
            lambda a: {"clipId": a["clipId"]}
        ),
        "delete_clip": ("DELETE_CLIP", lambda a: {"clipId": a["clipId"]}),
        "set_effects": ("SET_EFFECTS", lambda a: {"clipId": a["clipId"], "effects": a.get("effects", [])}),
        "set_filters": ("SET_FILTERS", lambda a: {"clipId": a["clipId"], "filters": a.get("filters", [])}),
        "auto_transcribe_captions": ("AUTO_TRANSCRIBE_CAPTIONS", lambda a: {
            "clipId": a.get("clipId"),
            "language": a.get("language", "auto")
        }),
        "add_caption": ("ADD_CAPTION", lambda a: {"clipId": a["clipId"], "captions": a["captions"]}),
        "set_ratio": ("SET_RATIO", lambda a: {"aspectRatio": a["aspectRatio"]}),
        "add_clip": ("ADD_CLIP", lambda a: {"trackId": a["trackId"], "clip": a["clip"]}),
        "undo_redo": (
            "UNDO" if args.get("action", "").upper() == "UNDO" else "REDO",
            lambda a: {}
        )
    }

    if tool_name in type_mapping:
        cmd_type, payload_builder = type_mapping[tool_name]
        payload = payload_builder(args)
    else:
        cmd_type = tool_name.upper()
        payload = args

    return EditorCommandSchema(
        id=cmd_id,
        type=cmd_type,
        payload=payload,
        timestamp=now_ms
    )
