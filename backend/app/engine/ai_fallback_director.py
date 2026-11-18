import re
import uuid
from typing import List, Dict, Any, Optional, Tuple

from app.schemas.ai_assistant import (
    AIAssistantPromptRequest,
    AIAssistantResponse,
    ToolCallRequestItem,
    EditorCommandSchema
)
from app.engine.ai_assistant_validator import (
    validate_tool_call,
    tool_call_to_editor_command
)
from app.engine.ai_tier_engine import (
    smpte_timecode_to_seconds,
    db_to_linear_gain,
    parse_db_expression,
    parse_frames_expression
)

# ---------------------------------------------------------------------------
# Transition Aliases
# ---------------------------------------------------------------------------
TRANSITION_ALIASES: Dict[str, str] = {
    "swipe left": "slide_left",
    "swipe right": "slide_right",
    "swipe up": "push_up",
    "swipe": "slide_left",
    "slide left": "slide_left",
    "slide right": "slide_right",
    "wipe left": "slide_left",
    "wipe right": "slide_right",
    "wipe": "slide_left",
    "fade to black": "fade_black",
    "dip to black": "fade_black",
    "fade out": "fade_black",
    "fade black": "fade_black",
    "dip to white": "fade_white",
    "fade to white": "fade_white",
    "fade white": "fade_white",
    "cross dissolve": "cross_dissolve",
    "crossfade": "cross_dissolve",
    "cross fade": "cross_dissolve",
    "dissolve": "cross_dissolve",
    "zoom transition": "zoom_in",
    "zoom in": "zoom_in",
    "zoom out": "zoom_out",
    "zoom": "zoom_in",
    "push up": "push_up",
    "push": "push_up",
    "instant cut": "instant_cut",
    "cut": "instant_cut"
}

def resolve_transition_alias(text: str) -> Optional[str]:
    t_lower = text.lower()
    for alias, canonical in TRANSITION_ALIASES.items():
        if alias in t_lower:
            return canonical
    return None

# ---------------------------------------------------------------------------
# Platform to Aspect Ratio
# ---------------------------------------------------------------------------
PLATFORM_RATIO_MAP: Dict[str, str] = {
    "instagram reels": "9:16",
    "instagram": "9:16",
    "reels": "9:16",
    "tiktok": "9:16",
    "shorts": "9:16",
    "youtube shorts": "9:16",
    "vertical": "9:16",
    "portrait": "9:16",
    "story": "9:16",
    "stories": "9:16",
    "youtube": "16:9",
    "landscape": "16:9",
    "widescreen": "16:9",
    "standard": "16:9",
    "horizontal": "16:9",
    "square": "1:1",
    "1:1": "1:1",
    "post": "1:1",
    "cinematic": "21:9",
    "ultrawide": "21:9",
    "movie": "21:9"
}

# ---------------------------------------------------------------------------
# Filter and Effect Aliases
# ---------------------------------------------------------------------------
FILTER_ALIASES: Dict[str, str] = {
    "black and white": "noir_bw",
    "black & white": "noir_bw",
    "b&w": "noir_bw",
    "monochrome": "pure_mono",
    "cinematic": "cinematic_lut",
    "cinematic lut": "cinematic_lut",
    "teal and orange": "teal_and_orange",
    "teal & orange": "teal_and_orange",
    "hollywood": "hollywood_gold",
    "gold": "hollywood_gold",
    "warm": "hollywood_gold",
    "cyberpunk": "cyberpunk",
    "neon": "neon_blue",
    "moody": "moody_film",
    "film grain": "film_grain",
    "film": "moody_film",
    "vintage": "vhs_classic",
    "retro": "vhs_classic",
    "comic": "comic_book",
    "oil painting": "oil_painting",
    "contrast": "deep_contrast"
}

EFFECT_ALIASES: Dict[str, str] = {
    "vhs": "vhs_classic",
    "glitch": "vhs_classic",
    "blur": "blur",
    "glow": "glow",
    "film grain": "film_grain",
    "shake": "camera_shake"
}

# ---------------------------------------------------------------------------
# Tier-Aware Response Builders
# ---------------------------------------------------------------------------
def format_tier_response(tier: str, action_summary: str, next_step: Optional[str] = None) -> str:
    if tier == "professional":
        return action_summary
    elif tier == "intermediate":
        return f"✓ {action_summary}."
    else: # beginner
        res = f"🎬 {action_summary}!"
        if next_step:
            res += f" {next_step}"
        else:
            res += " Hit ▶️ to preview. You can press Ctrl+Z anytime to undo!"
        return res

# ---------------------------------------------------------------------------
# Clip Resolving Helper
# ---------------------------------------------------------------------------
def resolve_target_clip(
    timeline_state: Dict[str, Any],
    selected_clip_id: Optional[str],
    prompt: str
) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    raw_clips = timeline_state.get("clips", {})
    if isinstance(raw_clips, dict):
        clips_map = raw_clips
    elif isinstance(raw_clips, list):
        clips_map = {c.get("id"): c for c in raw_clips if isinstance(c, dict)}
    else:
        clips_map = {}

    if not clips_map:
        return None, None

    # 1. If user explicitly refers to a clip by ID or name
    p_lower = prompt.lower()
    for cid, cdata in clips_map.items():
        if cid.lower() in p_lower:
            return cid, cdata
        cname = str(cdata.get("name") or cdata.get("label") or "").lower()
        if cname and cname in p_lower:
            return cid, cdata

    # 2. Selected clip if valid
    if selected_clip_id and selected_clip_id in clips_map:
        return selected_clip_id, clips_map[selected_clip_id]

    # 3. Default to the first clip on timeline
    first_id = next(iter(clips_map.keys()))
    return first_id, clips_map[first_id]

# ---------------------------------------------------------------------------
# Semantic Fallback Director
# ---------------------------------------------------------------------------
def run_fallback_director(
    prompt: str,
    req: AIAssistantPromptRequest,
    detected_tier: str,
    remaining_credits: int,
    model_name: str
) -> AIAssistantResponse:
    """
    Tier 3 Semantic Fallback Director.
    Extracts intents, handles domain boundaries, aliases, and constructs
    validated editor commands with tier-aware responses.
    """
    p_lower = prompt.lower().strip()
    state = req.timelineState
    total_dur = float(state.get("duration", 0.0))
    current_time = float(req.currentTime or state.get("currentTime", 0.0))
    clip_id, target_clip = resolve_target_clip(state, req.selectedClipId, prompt)
    clip_dur = float(target_clip.get("duration", total_dur)) if target_clip else total_dur

    # 1. Out of scope / domain check
    non_video_triggers = [
        "python code", "write python", "write a code", "print 10 numbers",
        "solve this math", "capital of", "who is the president", "write an essay",
        "javascript code", "create a function"
    ]
    if any(trigger in p_lower for trigger in non_video_triggers) and "video" not in p_lower and "clip" not in p_lower:
        refusal = (
            "I am Veytrix AI, specialized exclusively in video editing and timeline production. "
            "I cannot assist with general programming, trivia, or non-video tasks. "
            "Let me know if you need help trimming clips, adding transitions, color grading, or editing your project!"
        )
        return AIAssistantResponse(
            success=True,
            message=refusal,
            responseText=refusal,
            planSteps=[],
            requiresConfirmation=False,
            tool_calls=[],
            commands=[],
            validation_errors=[],
            remaining_credits=remaining_credits,
            model_used=model_name,
            userTier=detected_tier
        )

    # 2. Undo / Redo
    if re.search(r"\b(undo|revert|go back)\b", p_lower):
        tool_call = ToolCallRequestItem(name="undo_redo", args={"action": "UNDO"})
        cmd = tool_call_to_editor_command("undo_redo", {"action": "UNDO"})
        resp = format_tier_response(detected_tier, "Undoing your last edit")
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=["Undo last action"],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )
    if re.search(r"\b(redo|re-do)\b", p_lower):
        tool_call = ToolCallRequestItem(name="undo_redo", args={"action": "REDO"})
        cmd = tool_call_to_editor_command("undo_redo", {"action": "REDO"})
        resp = format_tier_response(detected_tier, "Redoing your last edit")
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=["Redo last action"],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 3. Captions & Subtitles
    if any(k in p_lower for k in ["caption", "subtitle", "transcribe", "subtitles", "captions"]):
        plan = ["Transcribe spoken audio dialogue into word-synchronized subtitle captions on the timeline"]
        tool_item = ToolCallRequestItem(
            name="auto_transcribe_captions",
            args={"clipId": clip_id, "language": "auto"}
        )
        cmd = tool_call_to_editor_command("auto_transcribe_captions", {"clipId": clip_id, "language": "auto"})
        resp_text = format_tier_response(detected_tier, "Transcribing spoken audio dialogue into synchronized subtitle captions")
        return AIAssistantResponse(
            success=True,
            message=resp_text,
            responseText=resp_text,
            planSteps=plan,
            requiresConfirmation=False,
            tool_calls=[tool_item],
            commands=[cmd],
            validation_errors=[],
            remaining_credits=remaining_credits,
            model_used=model_name,
            userTier=detected_tier
        )

    # 4. Multi-Split into N clips
    m_split_n = re.search(r"split.*into\s*(\d+)\s*clips?", p_lower)
    if m_split_n:
        from app.engine.timeline_simulator import TimelineSimulator
        n_clips = max(2, min(10, int(m_split_n.group(1))))
        effective_dur = clip_dur if clip_dur > 0 else total_dur
        step = effective_dur / n_clips

        simulator = TimelineSimulator(state)
        palette = ["cross_dissolve", "fade_black", "zoom_in", "slide_left", "push_up", "fade_white"]
        commands: List[EditorCommandSchema] = []
        tool_items: List[ToolCallRequestItem] = []
        plan: List[str] = []

        cid_target = clip_id or "clip-1"
        for i in range(1, n_clips):
            split_at = round(step * i, 2)
            part_id = f"clip-part-{uuid.uuid4().hex[:6]}"
            sim_ok, target_cid, _ = simulator.split_clip(cid_target, split_at, part_id)
            actual_cid = target_cid or cid_target

            split_args = {"clipId": actual_cid, "splitTime": split_at, "newClipId": part_id}
            tool_items.append(ToolCallRequestItem(name="split_clip", args=split_args))
            commands.append(tool_call_to_editor_command("split_clip", split_args))
            plan.append(f"Cut clip at {split_at}s")

        if "transition" in p_lower:
            hint_trans = resolve_transition_alias(p_lower)
            sim_clips = simulator.get_all_clip_ids()
            seam_clips = sim_clips[:-1]
            for i, scid in enumerate(seam_clips):
                t_type = hint_trans if hint_trans else palette[i % len(palette)]
                t_args = {"clipId": scid, "type": t_type, "duration": 0.5}
                tool_items.append(ToolCallRequestItem(name="add_transition", args=t_args))
                commands.append(tool_call_to_editor_command("add_transition", t_args))
                plan.append(f"Apply '{t_type}' transition between segment {i+1} and {i+2}")

        resp_text = format_tier_response(detected_tier, f"Planned out {len(commands)} editing steps to split video into {n_clips} segments")
        return AIAssistantResponse(
            success=True,
            message=resp_text,
            responseText=resp_text,
            planSteps=plan,
            requiresConfirmation=True,
            tool_calls=tool_items,
            commands=commands,
            validation_errors=[],
            remaining_credits=remaining_credits,
            model_used=model_name,
            userTier=detected_tier
        )

    # 5. Aspect Ratio / Platform Sizing
    if any(k in p_lower for k in ["aspect ratio", "ratio", "vertical", "horizontal", "square", "9:16", "16:9", "1:1", "21:9", "instagram", "tiktok", "reels", "shorts", "youtube"]):
        matched_ratio = None
        for plat, ratio in PLATFORM_RATIO_MAP.items():
            if plat in p_lower:
                matched_ratio = ratio
                break
        if not matched_ratio:
            m_direct = re.search(r"\b(16:9|9:16|1:1|4:5|21:9)\b", p_lower)
            if m_direct:
                matched_ratio = m_direct.group(1)

        if matched_ratio:
            tool_call = ToolCallRequestItem(name="set_ratio", args={"aspectRatio": matched_ratio})
            cmd = tool_call_to_editor_command("set_ratio", {"aspectRatio": matched_ratio})
            desc = f"Switched project aspect ratio to {matched_ratio}"
            resp = format_tier_response(detected_tier, desc, "Looking good! Let me know if you want to scale the video to fill the frame.")
            return AIAssistantResponse(
                success=True, message=resp, responseText=resp, planSteps=[desc],
                tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
                model_used=model_name, userTier=detected_tier
            )

    # 4. Transitions
    if "transition" in p_lower or any(t in p_lower for t in ["dissolve", "swipe", "fade black", "fade white", "slide", "wipe"]):
        trans_type = resolve_transition_alias(p_lower) or "cross_dissolve"
        dur = 0.5
        m_dur = re.search(r"(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)", p_lower)
        if m_dur:
            dur = float(m_dur.group(1))

        if clip_id:
            args = {"clipId": clip_id, "type": trans_type, "duration": dur}
            tool_call = ToolCallRequestItem(name="add_transition", args=args)
            cmd = tool_call_to_editor_command("add_transition", args)
            desc = f"Added '{trans_type}' transition ({dur}s) to clip '{clip_id}'"
            resp = format_tier_response(detected_tier, desc)
            return AIAssistantResponse(
                success=True, message=resp, responseText=resp, planSteps=[desc],
                tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
                model_used=model_name, userTier=detected_tier
            )

    # 5. Volume & Mute
    if "mute" in p_lower or "unmute" in p_lower:
        is_mute = "unmute" not in p_lower
        if "track" in p_lower:
            args = {"trackId": "video", "muted": is_mute}
            tool_call = ToolCallRequestItem(name="mute_track", args=args)
            cmd = tool_call_to_editor_command("mute_track", args)
            desc = f"{'Muted' if is_mute else 'Unmuted'} audio track"
        else:
            cid = clip_id or "clip-1"
            args = {"clipId": cid, "muted": is_mute}
            tool_call = ToolCallRequestItem(name="mute_clip", args=args)
            cmd = tool_call_to_editor_command("mute_clip", args)
            desc = f"{'Muted' if is_mute else 'Unmuted'} clip '{cid}'"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    if any(k in p_lower for k in ["volume", "louder", "quieter", "too loud", "too quiet", "sound", "turn up", "turn down", "db"]):
        vol = 1.0
        # Check dB format
        db_gain = parse_db_expression(p_lower)
        if db_gain is not None:
            vol = db_gain
        elif "too loud" in p_lower or "quieter" in p_lower or "turn down" in p_lower:
            vol = 0.25
        elif "louder" in p_lower or "turn up" in p_lower:
            vol = 1.5
        elif "50%" in p_lower:
            vol = 0.5
        elif "25%" in p_lower:
            vol = 0.25
        elif "75%" in p_lower:
            vol = 0.75
        elif "100%" in p_lower:
            vol = 1.0

        cid = clip_id or "clip-1"
        args = {"clipId": cid, "volume": vol}
        tool_call = ToolCallRequestItem(name="set_audio_volume", args=args)
        cmd = tool_call_to_editor_command("set_audio_volume", args)
        desc = f"Adjusted volume on clip '{cid}' to {vol * 100:.0f}%"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 6. Playback Speed
    if any(k in p_lower for k in ["speed", "slow down", "speed up", "fast forward", "slow mo", "timelapse", "0.5x", "2x"]):
        speed = 1.0
        m_speed = re.search(r"(\d+(?:\.\d+)?)\s*x", p_lower)
        if m_speed:
            speed = float(m_speed.group(1))
        elif "slow down" in p_lower or "slow mo" in p_lower:
            speed = 0.5
        elif "speed up" in p_lower or "fast forward" in p_lower:
            speed = 2.0

        cid = clip_id or "clip-1"
        args = {"clipId": cid, "speed": speed}
        tool_call = ToolCallRequestItem(name="set_speed", args=args)
        cmd = tool_call_to_editor_command("set_speed", args)
        desc = f"Changed playback speed on clip '{cid}' to {speed}x"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 7. Reverse Clip
    if "reverse" in p_lower or "backwards" in p_lower:
        cid = clip_id or "clip-1"
        args = {"clipId": cid}
        tool_call = ToolCallRequestItem(name="reverse_clip", args=args)
        cmd = tool_call_to_editor_command("reverse_clip", args)
        desc = f"Reversed playback of clip '{cid}'"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 8. Freeze Frame
    if "freeze" in p_lower or "still frame" in p_lower:
        freeze_dur = 3.0
        m_fdur = re.search(r"(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)", p_lower)
        if m_fdur:
            freeze_dur = float(m_fdur.group(1))

        cid = clip_id or "clip-1"
        args = {"clipId": cid, "freezeTime": current_time, "duration": freeze_dur}
        tool_call = ToolCallRequestItem(name="freeze_clip", args=args)
        cmd = tool_call_to_editor_command("freeze_clip", args)
        desc = f"Added {freeze_dur}s freeze frame at {current_time:.2f}s on clip '{cid}'"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 9. Filters & Color Grading
    if any(k in p_lower for k in ["filter", "grade", "lut", "color", "cinematic", "black and white", "monochrome", "warm", "vintage"]):
        chosen_filter = "cinematic_lut"
        for alias, fname in FILTER_ALIASES.items():
            if alias in p_lower:
                chosen_filter = fname
                break
        cid = clip_id or "clip-1"
        args = {"clipId": cid, "filters": [{"type": chosen_filter, "intensity": 1.0}]}
        tool_call = ToolCallRequestItem(name="set_filters", args=args)
        cmd = tool_call_to_editor_command("set_filters", args)
        desc = f"Applied '{chosen_filter}' filter to clip '{cid}'"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 10. Visual Effects
    if any(k in p_lower for k in ["effect", "vhs", "glitch", "blur", "glow", "grain", "shake"]):
        chosen_effect = "vhs_classic"
        for alias, ename in EFFECT_ALIASES.items():
            if alias in p_lower:
                chosen_effect = ename
                break
        cid = clip_id or "clip-1"
        args = {"clipId": cid, "effects": [{"type": chosen_effect, "parameters": {}}]}
        tool_call = ToolCallRequestItem(name="set_effects", args=args)
        cmd = tool_call_to_editor_command("set_effects", args)
        desc = f"Applied '{chosen_effect}' effect to clip '{cid}'"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 11. Duplicate Clip
    if "duplicate" in p_lower or "copy clip" in p_lower:
        cid = clip_id or "clip-1"
        args = {"clipId": cid}
        tool_call = ToolCallRequestItem(name="duplicate_clip", args=args)
        cmd = tool_call_to_editor_command("duplicate_clip", args)
        desc = f"Duplicated clip '{cid}'"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 12. Delete Clip
    if "delete" in p_lower or "remove clip" in p_lower:
        cid = clip_id or "clip-1"
        args = {"clipId": cid}
        tool_call = ToolCallRequestItem(name="delete_clip", args=args)
        cmd = tool_call_to_editor_command("delete_clip", args)
        desc = f"Deleted clip '{cid}'"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 13. Scale / Zoom Transform
    if "scale" in p_lower or "zoom in" in p_lower or "fill the frame" in p_lower:
        scale_val = 1.2
        m_sc = re.search(r"(\d+(?:\.\d+)?)\s*%", p_lower)
        if m_sc:
            scale_val = float(m_sc.group(1)) / 100.0
        cid = clip_id or "clip-1"
        args = {"clipId": cid, "scale": scale_val}
        tool_call = ToolCallRequestItem(name="set_clip_transform", args=args)
        cmd = tool_call_to_editor_command("set_clip_transform", args)
        desc = f"Scaled clip '{cid}' to {scale_val * 100:.0f}%"
        resp = format_tier_response(detected_tier, desc)
        return AIAssistantResponse(
            success=True, message=resp, responseText=resp, planSteps=[desc],
            tool_calls=[tool_call], commands=[cmd], remaining_credits=remaining_credits,
            model_used=model_name, userTier=detected_tier
        )

    # 14. Tier 4: Smart Clarification if completely ambiguous
    clarifications = {
        "beginner": "I'm ready to help with your video! Tell me what you'd like to do — for example: 'make it vertical for Instagram', 'add music', 'trim the beginning', or 'add a transition'.",
        "intermediate": "Command not recognized. You can specify cuts, trims, transitions (e.g. 'swipe left', 'cross dissolve'), speed, volume, or filters.",
        "professional": "Ambiguous command. Specify operation (timecode, transition type, dB gain, cut point)."
    }
    clar_msg = clarifications.get(detected_tier, clarifications["beginner"])
    return AIAssistantResponse(
        success=True,
        message=clar_msg,
        responseText=clar_msg,
        planSteps=[],
        requiresConfirmation=False,
        tool_calls=[],
        commands=[],
        validation_errors=[],
        remaining_credits=remaining_credits,
        model_used=model_name,
        userTier=detected_tier
    )
