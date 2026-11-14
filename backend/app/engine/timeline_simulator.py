import uuid
import copy
from typing import Dict, Any, List, Optional, Tuple

class TimelineSimulator:
    """
    In-memory timeline state simulator for complex multi-tool sequences.
    Simulates cuts, trims, and additions so subsequent tools (e.g. add_transition)
    can target newly generated clip IDs accurately.
    """

    def __init__(self, initial_state: Dict[str, Any]):
        self.state = copy.deepcopy(initial_state)
        # Normalize clips into a dict
        raw_clips = self.state.get("clips", {})
        if isinstance(raw_clips, list):
            self.clips: Dict[str, Dict[str, Any]] = {
                c.get("id"): copy.deepcopy(c) for c in raw_clips if isinstance(c, dict)
            }
        elif isinstance(raw_clips, dict):
            self.clips = {k: copy.deepcopy(v) for k, v in raw_clips.items()}
        else:
            self.clips = {}

    def get_clip(self, clip_id: str) -> Optional[Dict[str, Any]]:
        return self.clips.get(clip_id)

    def get_all_clip_ids(self) -> List[str]:
        # Sort by start time
        return sorted(self.clips.keys(), key=lambda cid: self.clips[cid].get("start", 0.0))

    def split_clip(self, clip_id: str, split_time: float, new_clip_id: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Splits a clip into two at split_time.
        If clip_id is not directly found (e.g. previous cut created new segments),
        locates whichever segment currently contains split_time.
        Returns: (success, left_clip_id, right_clip_id)
        """
        target_clip = self.clips.get(clip_id)
        actual_id = clip_id

        # If clip_id doesn't exist or doesn't encompass split_time, find containing segment
        if not target_clip or not (target_clip.get("start", 0.0) < split_time < (target_clip.get("start", 0.0) + target_clip.get("duration", 0.0))):
            found_id = None
            for cid, c in self.clips.items():
                start = c.get("start", 0.0)
                end = start + c.get("duration", 0.0)
                if start < split_time < end:
                    found_id = cid
                    target_clip = c
                    break
            if found_id:
                actual_id = found_id
            else:
                return False, None, None

        if not target_clip:
            return False, None, None

        start = target_clip.get("start", 0.0)
        dur = target_clip.get("duration", 0.0)
        left_dur = split_time - start
        right_dur = dur - left_dur
        right_id = new_clip_id or f"clip-{uuid.uuid4().hex[:8]}"

        # Update left
        target_clip["duration"] = left_dur

        # Create right
        right_clip = copy.deepcopy(target_clip)
        right_clip["id"] = right_id
        right_clip["start"] = split_time
        right_clip["duration"] = right_dur
        right_clip["name"] = f"{target_clip.get('name', 'Clip')} (Part 2)"

        self.clips[right_id] = right_clip
        return True, actual_id, right_id

    def trim_clip(self, clip_id: str, edge: str, new_time: float) -> bool:
        clip = self.clips.get(clip_id)
        if not clip:
            return False

        start = clip.get("start", 0.0)
        dur = clip.get("duration", 0.0)
        current_end = start + dur

        if edge == "left":
            if new_time >= current_end - 0.1:
                return False
            clip["start"] = new_time
            clip["duration"] = current_end - new_time
        else:
            if new_time <= start + 0.1:
                return False
            clip["duration"] = new_time - start

        return True
