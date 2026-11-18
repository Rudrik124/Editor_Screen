import json
import logging
import urllib.request
import urllib.error
import re
import uuid
import time
from typing import List, Dict, Any, Tuple, Optional
from app.core.config import settings
from app.engine.ai_tools_schemas import GEMINI_TOOLS_SCHEMA
from app.engine.ai_assistant_validator import (
    validate_tool_call,
    tool_call_to_editor_command
)
from app.engine.ai_fallback_director import (
    run_fallback_director,
    resolve_transition_alias
)
from app.engine.ai_tier_engine import (
    detect_user_tier,
    smpte_timecode_to_seconds,
    db_to_linear_gain,
    parse_db_expression,
    parse_frames_expression
)
from app.engine.timeline_simulator import TimelineSimulator
from app.schemas.ai_assistant import (
    AIAssistantPromptRequest,
    AIAssistantResponse,
    ToolCallRequestItem,
    EditorCommandSchema
)

logger = logging.getLogger("veytrix.ai_assistant")

SYSTEM_PERSONA_PROMPT = """You are Veytrix AI, the intelligent, creative video editing copilot embedded directly inside Veytrix Video Editor.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER TIER: {user_tier_upper}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{user_tier_instructions}

YOUR EDITORIAL PHILOSOPHY & RESPONSIBILITIES:
- You are an expert director, editor, and colorist.
- When the user asks you to edit their video, don't just execute robotically: provide an engaging, professional editorial response that explains the creative rationale (e.g., pacing, mood, visual rhythm, color harmony).
- Format your response clearly with a helpful conversational introduction, bulleted steps, and why the specific choices were made!
- If the user is a BEGINNER: Be warm, encouraging, celebratory, and guide them with simple terms and next steps.
- If the user is an INTERMEDIATE: Be direct, fast, summarize technical gains, and respect their vocabulary.
- If the user is a PROFESSIONAL: Be clinical, exact, note timecodes, dB gains, frame accuracy, and handle integrity.

FULL CAPABILITIES & AVAILABLE FEATURES (25 INTEGRATED TOOLS):
1. CLIP EDITING & ARRANGEMENT:
   - `duplicate_clip`: Clones clip with timing, transforms, filters, and metadata.
   - `split_clip`: Cuts a clip at an exact second or timecode into two contiguous clips.
   - `trim_clip`: Modifies in-point (start) or out-point (end) boundaries.
   - `replace_clip`: Swaps media asset while retaining all effects, keyframes, and timing.
   - `rename_clip`: Renames clip labels for timeline organization.
   - `lock_clip`: Protects or unlocks clips from accidental modifications.
   - `delete_clip`: Removes clips from timeline.
   - `undo_redo`: Command-bus history actions ('UNDO' or 'REDO').

2. TIME & PLAYBACK MANIPULATION:
   - `set_speed`: Dynamic speed changes from 0.1x to 4.0x (e.g. 0.5x slow-mo, 2.0x timelapse).
   - `reverse_clip`: Reverses playback direction for video and audio.
   - `freeze_clip`: Holds an exact freeze frame at a timestamp for a given duration (default 3.0s).

3. MOTION, LAYERING & TRANSITIONS:
   - `add_transition`: Connects clips at cut points. Available: `cross_dissolve`, `slide_left`, `slide_right`, `zoom_in`, `zoom_out`, `push_up`, `fade_black`, `fade_white`, `dip_to_color`, `instant_cut`.
   - `remove_transition`: Clears transitions from a clip.
   - `set_overlap`: Picture-in-Picture (PIP) and multi-track layering. Moves a clip to the dedicated Overlay track ('overlay-clip') or back to the main track ('video') with PIP transform scaling (e.g. scale=0.4, positionX=250, positionY=-150). Whenever the user asks for "PIP", "picture-in-picture", "overlay", or "add/move clip to overlay", ALWAYS call `set_overlap` with targetTrackId='overlay-clip'!
   - `set_clip_transform`: Controls position (X/Y), scale (1.0 = 100%), opacity (0.0 to 1.0), and rotation angle.
   - `add_keyframe`: Animates properties over time (opacity, scale, rotation, positionX, positionY, volume).
   - `remove_keyframe`: Deletes animation keyframes by ID.
   - `set_ratio`: Sets canvas aspect ratio (`16:9`, `9:16`, `1:1`, `4:5`, `21:9`).
   - `set_cover`: Sets the project poster / thumbnail frame.

4. AUDIO PIPELINE:
   - `extract_audio`: Detaches audio from video into a dedicated audio track and mutes original.
   - `set_audio_volume`: Sets gain from 0.0 to 5.0 (supports dB conversion: volume = 10^(dB/20)).
   - `mute_clip`: Mutes or unmutes a specific clip.
   - `mute_track`: Mutes or unmutes an entire audio or video track.

5. VISUAL LOOKS, COLOR & SUBTITLES:
   - `set_filters`: Color grading LUTs (`teal_and_orange`, `hollywood_gold`, `moody_film`, `noir_bw`, `cyberpunk`, `neon_blue`, `forest_green`, `ocean_blue`, `cinematic_lut`, `deep_contrast`).
   - `set_effects`: Visual GLSL shaders (`vhs_classic`, `camera_shake`, `film_grain`, `blur`, `glow`).
   - `auto_transcribe_captions`: Whisper-powered auto-transcription of speech to subtitles.
   - `add_caption`: Manual custom subtitle blocks.

TIMELINE STATE MANIFEST:
- Total Project Duration: {duration}s ({duration_formatted})
- Canvas Aspect Ratio: {aspect_ratio}
- Current Playhead Position: {current_time}s
- Selected Clip ID: {selected_clip}
- Available Timeline Tracks: Text (id: 'text'), Overlay/PIP (id: 'overlay-clip'), Video (id: 'video'), Audio Track (id: 'audio')
- Active Clips on Timeline:
{clips_formatted}

CRITICAL RULES:
1. Always output both an informative, encouraging natural language response text AND the corresponding tool calls!
2. When multiple tasks are requested (trim, cut, transitions, effects), ALWAYS execute all of them in a coordinated sequence!
3. If the user asks for "other", "different", or "best" transitions and effects, actively select creative, complementary choices across the clips!
4. Strictly refuse out-of-scope non-video tasks (e.g. general Python coding, history, trivia).
"""

def format_duration(seconds: float) -> str:
    secs = float(seconds)
    if secs < 60:
        return f"{round(secs, 2)}s"
    mins = int(secs // 60)
    rem_secs = round(secs % 60, 2)
    return f"{mins}m {rem_secs}s"

def parse_time_expression(text: str) -> Optional[float]:
    """Parses expressions like '1.50 mins', '1.5 mins', '90s', '1 min 25s' into seconds."""
    text = text.lower().strip()

    # Pattern: X min Y sec
    m_combo = re.search(r"(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)?", text)
    if m_combo:
        mins = float(m_combo.group(1))
        secs = float(m_combo.group(2))
        return mins * 60.0 + secs

    # Pattern: X.XX mins or X mins
    m_min = re.search(r"(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)", text)
    if m_min:
        mins = float(m_min.group(1))
        return mins * 60.0

    # Pattern: X secs or Xs
    m_sec = re.search(r"(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)", text)
    if m_sec:
        return float(m_sec.group(1))

    return None

def build_system_instruction(req: AIAssistantPromptRequest, user_tier: str = "beginner") -> str:
    state = req.timelineState
    duration = float(state.get("duration", 0.0))
    aspect_ratio = state.get("aspectRatio", "16:9")
    current_time = float(req.currentTime or state.get("currentTime", 0.0))
    selected_clip = req.selectedClipId or state.get("selectedClipId", "none")

    raw_clips = state.get("clips", {})
    if isinstance(raw_clips, dict):
        clips_list = list(raw_clips.values())
    elif isinstance(raw_clips, list):
        clips_list = raw_clips
    else:
        clips_list = []

    clip_lines = []
    for c in clips_list:
        if isinstance(c, dict):
            cid = c.get("id", "clip")
            cname = c.get("name") or c.get("label") or "Media Clip"
            cstart = float(c.get("start", 0.0))
            cdur = float(c.get("duration", 0.0))
            cend = round(cstart + cdur, 2)
            clocked = " [LOCKED]" if c.get("locked") else ""
            clip_lines.append(
                f"  • Clip '{cname}' (ID: {cid}): Start={cstart}s, End={cend}s, Duration={cdur}s ({format_duration(cdur)}){clocked}"
            )

    clips_formatted = "\n".join(clip_lines) if clip_lines else "  • No clips on timeline."

    if user_tier == "professional":
        user_tier_instructions = (
            "- Direct, precise, frame-accurate responses.\n"
            "- Accept SMPTE timecodes (HH:MM:SS:FF) and decibel (dB) gain instructions natively.\n"
            "- Never explain basic editing jargon or second-guess standard film techniques (e.g. J-cuts, L-cuts, LUTs)."
        )
    elif user_tier == "intermediate":
        user_tier_instructions = (
            "- Efficient, concise one-line confirmations.\n"
            "- Use editing terminology naturally (transitions, keyframes, b-roll, audio ducking, LUTs).\n"
            "- Summarize batch operations clearly."
        )
    else:
        user_tier_instructions = (
            "- Warm, friendly, supportive guidance without overwhelming jargon.\n"
            "- Explain concepts simply when requested (e.g. trimming, vertical ratio, background music).\n"
            "- Reassure the user that changes are safe and undoable via Ctrl+Z."
        )

    return SYSTEM_PERSONA_PROMPT.format(
        user_tier_upper=user_tier.upper(),
        user_tier_instructions=user_tier_instructions,
        duration=duration,
        duration_formatted=format_duration(duration),
        aspect_ratio=aspect_ratio,
        current_time=current_time,
        selected_clip=selected_clip,
        clips_formatted=clips_formatted
    )

def handle_safety_and_conversational_guardrails(
    prompt: str,
    req: AIAssistantPromptRequest,
    remaining_credits: int,
    model_name: str
) -> Optional[AIAssistantResponse]:
    """
    Evaluates prompt ONLY for strict safety guardrails:
    1. Out-of-scope non-video queries (e.g. general Python coding, history, trivia)
    2. Affirmative plan confirmations ('proceed', 'apply', 'yes')
    3. Trims exceeding total video duration (impossible boundary)
    4. Splits completely outside video bounds (impossible boundary)

    All real editing intents are passed directly to Gemini!
    """
    p_lower = prompt.lower().strip()
    state = req.timelineState
    total_dur = float(state.get("duration", 0.0))

    raw_clips = state.get("clips", {})
    clips_list = list(raw_clips.values()) if isinstance(raw_clips, dict) else (raw_clips if isinstance(raw_clips, list) else [])
    first_clip = clips_list[0] if clips_list and isinstance(clips_list[0], dict) else None
    clip_dur = float(first_clip.get("duration", total_dur)) if first_clip else total_dur
    clip_id = first_clip.get("id", "video-clip") if first_clip else "video-clip"

    # 1. Out of scope queries (e.g. general Python coding, history, trivia)
    non_video_triggers = [
        "python code", "write python", "write a code", "print 10 numbers",
        "solve this math", "capital of", "who is the president", "write an essay"
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
            model_used=model_name
        )

    # Affirmative confirmation (e.g. "proceed", "proceed with plan", "yes", "apply")
    affirmative_words = {"proceed", "proceed with plan", "apply", "apply plan", "yes", "confirm", "do it", "go ahead", "execute"}
    if p_lower in affirmative_words:
        msg = "Ready to proceed! You can click the 'Apply Plan' button on the plan card above, or tell me if you'd like any modifications."
        return AIAssistantResponse(
            success=True,
            message=msg,
            responseText=msg,
            planSteps=[],
            requiresConfirmation=False,
            tool_calls=[],
            commands=[],
            validation_errors=[],
            remaining_credits=remaining_credits,
            model_used=model_name
        )

    # Boundary Check: trim exceeding duration
    parsed_target = parse_time_expression(prompt)
    if "trim" in p_lower and parsed_target is not None:
        effective_dur = clip_dur if clip_dur > 0 else total_dur
        if parsed_target > (effective_dur + 0.1):
            msg = (
                f"Your video is currently {effective_dur:.2f} seconds ({format_duration(effective_dur)}) long. "
                f"It cannot be trimmed to {parsed_target:.2f} seconds ({format_duration(parsed_target)}) because that exceeds "
                f"the total length of the video.\n\n"
                f"Would you like me to trim it to a shorter length, such as {max(10, int(effective_dur * 0.75))} seconds?"
            )
            return AIAssistantResponse(
                success=True,
                message=msg,
                responseText=msg,
                planSteps=[],
                requiresConfirmation=False,
                tool_calls=[],
                commands=[],
                validation_errors=[],
                remaining_credits=remaining_credits,
                model_used=model_name
            )

    # Boundary Check: split completely outside duration
    if "split" in p_lower and ("to" in p_lower or "from" in p_lower):
        m_range = re.findall(r"(\d+(?:\.\d+)?\s*(?:min|mins|minute|minutes|s|sec|secs|seconds)?)", p_lower)
        parsed_times = []
        for match in m_range:
            t = parse_time_expression(match)
            if t is not None:
                parsed_times.append(t)

        effective_dur = clip_dur if clip_dur > 0 else total_dur
        if len(parsed_times) >= 2 and any(t > (effective_dur + 0.1) for t in parsed_times):
            msg = (
                f"The video ends at {effective_dur:.2f} seconds ({format_duration(effective_dur)}). "
                f"The requested time range ({[format_duration(t) for t in parsed_times]}) is beyond the end of the video. "
                f"Please specify timestamps within 0s to {effective_dur:.2f}s."
            )
            return AIAssistantResponse(
                success=True,
                message=msg,
                responseText=msg,
                planSteps=[],
                requiresConfirmation=False,
                tool_calls=[],
                commands=[],
                validation_errors=[],
                remaining_credits=remaining_credits,
                model_used=model_name
            )

    # Let ALL editing prompts pass through to Gemini!
    return None

def call_gemini_conversational(
    prompt: str,
    system_instruction: str,
    conversation_history: List[Any],
    api_key: str,
    model_name: str,
    timeout: int = 120
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Calls Gemini API with both text generation and function calling.
    Returns: (conversational_text, list_of_tool_calls)
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    contents = []
    for turn in conversation_history[-8:]:
        role = "user" if getattr(turn, "role", "") == "user" or (isinstance(turn, dict) and turn.get("role") == "user") else "model"
        text = getattr(turn, "content", "") if hasattr(turn, "content") else (turn.get("content", "") if isinstance(turn, dict) else "")
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})

    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "tools": GEMINI_TOOLS_SCHEMA,
        "tool_config": {"function_calling_config": {"mode": "AUTO"}}
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            res_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Gemini API HTTP Error {e.code}: {error_body}")
        raise RuntimeError(f"Gemini API returned HTTP {e.code}: {error_body}")
    except (urllib.error.URLError, TimeoutError) as e:
        if "timed out" in str(e).lower():
            logger.error(f"Gemini API timed out after {timeout}s: {e}")
            raise TimeoutError(f"AI model request timed out after {timeout} seconds.")
        logger.error(f"Gemini API Request Failed: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Gemini API Request Failed: {str(e)}")
        raise

    response_text = ""
    tool_calls = []

    candidates = res_data.get("candidates", [])
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            if "text" in part:
                response_text += part["text"] + "\n"
            if "functionCall" in part:
                fc = part["functionCall"]
                tool_calls.append({
                    "name": fc.get("name"),
                    "args": fc.get("args", {})
                })

    return response_text.strip(), tool_calls

def process_ai_assistant_request(
    req: AIAssistantPromptRequest,
    remaining_credits: int = 50
) -> AIAssistantResponse:
    """
    Processes request with conversational memory, timeline simulation, and plan generation.
    """
    api_key = settings.GEMINI_API_KEY
    model_name = settings.AI_MODEL_NAME or "gemini-3.1-flash-lite"

    # Detect user tier from history or explicit override
    history_prompts = [m.content for m in (req.conversationHistory or []) if m.role == "user"]
    history_prompts.append(req.prompt)
    detected_tier = req.userTier or detect_user_tier(history_prompts)

    # Pre-validation: strict safety guardrails only (domain boundaries, confirmations)
    guardrail_turn = handle_safety_and_conversational_guardrails(
        prompt=req.prompt,
        req=req,
        remaining_credits=remaining_credits,
        model_name=model_name
    )
    if guardrail_turn is not None:
        guardrail_turn.userTier = detected_tier
        return guardrail_turn

    system_prompt = build_system_instruction(req, user_tier=detected_tier)

    raw_tool_calls: List[Dict[str, Any]] = []
    response_text = ""
    ai_timeout = getattr(settings, "AI_REQUEST_TIMEOUT_SECONDS", 120)
    timed_out = False

    if api_key:
        try:
            response_text, raw_tool_calls = call_gemini_conversational(
                prompt=req.prompt,
                system_instruction=system_prompt,
                conversation_history=req.conversationHistory or [],
                api_key=api_key,
                model_name=model_name,
                timeout=ai_timeout
            )
        except TimeoutError as te:
            logger.warning(f"Live Gemini API timed out: {te}")
            timed_out = True
        except Exception as e:
            logger.warning(f"Live Gemini API unavailable, processing with conversational director: {e}")

    if timed_out:
        timeout_msg = f"The AI request timed out after {ai_timeout}s. Your credit has been refunded. Please try simplifying your prompt or breaking it into smaller steps."
        return AIAssistantResponse(
            success=False,
            message=timeout_msg,
            responseText=timeout_msg,
            planSteps=[],
            requiresConfirmation=False,
            tool_calls=[],
            commands=[],
            validation_errors=[timeout_msg],
            remaining_credits=remaining_credits,
            model_used=model_name,
            userTier=detected_tier
        )

    # If conversational query with no tool calls
    if not raw_tool_calls:
        if response_text and response_text.strip():
            return AIAssistantResponse(
                success=True,
                message=response_text.strip(),
                responseText=response_text.strip(),
                planSteps=[],
                requiresConfirmation=False,
                tool_calls=[],
                commands=[],
                validation_errors=[],
                remaining_credits=remaining_credits,
                model_used=model_name,
                userTier=detected_tier
            )
        else:
            # Escalate to Tier 3 Semantic Fallback Director
            return run_fallback_director(
                prompt=req.prompt,
                req=req,
                detected_tier=detected_tier,
                remaining_credits=remaining_credits,
                model_name=model_name
            )

    # Initialize Simulator to resolve multi-step chain dependencies
    simulator = TimelineSimulator(req.timelineState)
    validated_tool_calls: List[ToolCallRequestItem] = []
    commands: List[EditorCommandSchema] = []
    plan_steps: List[str] = []
    errors: List[str] = []

    transition_palette = [
        "cross_dissolve",
        "fade_black",
        "zoom_in",
        "slide_left",
        "push_up",
        "fade_white"
    ]

    for call in raw_tool_calls:
        name = call.get("name")
        args = call.get("args", {})

        if name == "split_clip":
            split_time = float(args.get("splitTime", 0.0))
            cid = args.get("clipId", "")
            new_cid = f"clip-part-{uuid.uuid4().hex[:6]}"
            args["newClipId"] = new_cid

            sim_ok, actual_cid, _ = simulator.split_clip(cid, split_time, new_cid)
            if not sim_ok:
                errors.append(f"Cannot split clip: timestamp {split_time:.2f}s is outside clip boundaries.")
                continue

            args["clipId"] = actual_cid
            validated_tool_calls.append(ToolCallRequestItem(name=name, args=args))
            cmd = tool_call_to_editor_command(name, args)
            commands.append(cmd)
            plan_steps.append(f"Cut clip at {round(split_time, 2)}s")
            continue

        elif name == "trim_clip":
            valid, err_msg, validated_args = validate_tool_call(
                tool_name=name,
                raw_args=args,
                timeline_state={"clips": simulator.clips}
            )
            if not valid:
                errors.append(err_msg or "Invalid trim call")
                continue
            v_args = validated_args or args
            simulator.trim_clip(v_args["clipId"], v_args.get("edge", "right"), v_args.get("newTime", 0.0))
            validated_tool_calls.append(ToolCallRequestItem(name=name, args=v_args))
            commands.append(tool_call_to_editor_command(name, v_args))
            plan_steps.append(f"Trim clip boundary to {round(float(v_args.get('newTime', 0.0)), 2)}s")
            continue

        elif name == "extract_audio":
            plan_steps.append("Detach audio into dedicated soundtrack")

        elif name == "mute_clip":
            is_muted = args.get("muted", True)
            plan_steps.append(f"{'Mute' if is_muted else 'Unmute'} clip audio")

        elif name == "set_audio_volume":
            vol = args.get("volume", 1.0)
            plan_steps.append(f"Set audio volume to {int(vol * 100)}%")

        elif name == "auto_transcribe_captions":
            plan_steps.append("Transcribe spoken audio dialogue to subtitles")

        elif name == "add_transition":
            plan_steps.append(f"Add {args.get('type', 'cross_dissolve')} transition to clip")

        elif name == "set_filters":
            f_list = args.get("filters", [])
            f_names = ", ".join([f.get("type", "filter") for f in f_list]) if f_list else "filter"
            plan_steps.append(f"Apply filter ({f_names}) to clip")

        elif name == "set_effects":
            e_list = args.get("effects", [])
            e_names = ", ".join([e.get("type", "effect") for e in e_list]) if e_list else "effect"
            plan_steps.append(f"Apply visual effect ({e_names}) to clip")

        valid, err_msg, validated_args = validate_tool_call(
            tool_name=name,
            raw_args=args,
            timeline_state={"clips": simulator.clips}
        )

        if not valid:
            errors.append(err_msg or f"Invalid call {name}")
            continue

        validated_tool_calls.append(ToolCallRequestItem(name=name, args=validated_args or args))
        cmd = tool_call_to_editor_command(name, validated_args or args)
        commands.append(cmd)

    # Distribute transitions across seams if user specifically asked for generic / different transitions across cuts
    # (e.g. "split into clips and add transitions" or "add different transitions")
    # BUT if Gemini already returned specific add_transition commands (e.g. user asked for "swipe left" / "fade black"), PRESERVE THEM!
    user_prompt_lower = req.prompt.lower()
    all_sim_clip_ids = simulator.get_all_clip_ids()
    existing_transition_commands = [c for c in commands if c.type == "ADD_TRANSITION"]

    if "transition" in user_prompt_lower and len(all_sim_clip_ids) > 1 and len(existing_transition_commands) == 0:
        cut_seam_clips = all_sim_clip_ids[:-1]
        for i, cid in enumerate(cut_seam_clips):
            selected_trans = transition_palette[i % len(transition_palette)]
            trans_args = {
                "clipId": cid,
                "type": selected_trans,
                "duration": 0.5
            }
            validated_tool_calls.append(ToolCallRequestItem(name="add_transition", args=trans_args))
            commands.append(tool_call_to_editor_command("add_transition", trans_args))
            plan_steps.append(f"Apply '{selected_trans}' transition between clip {i+1} and {i+2}")

    success = len(commands) > 0 or len(errors) == 0
    requires_conf = len(commands) >= 4

    # Build rich, persona-grounded narrative if Gemini returned only tool calls
    if response_text and response_text.strip():
        summary_text = response_text.strip()
    else:
        # Group actions by type for natural explanation
        splits = [p for p in plan_steps if "cut" in p.lower() or "split" in p.lower()]
        trans = [p for p in plan_steps if "transition" in p.lower()]
        filters = [p for p in plan_steps if "filter" in p.lower()]
        effects = [p for p in plan_steps if "effect" in p.lower()]
        audio = [p for p in plan_steps if "audio" in p.lower() or "mute" in p.lower() or "volume" in p.lower()]
        captions = [p for p in plan_steps if "transcribe" in p.lower() or "subtitle" in p.lower() or "caption" in p.lower()]
        overlays = [p for p in plan_steps if "overlay" in p.lower() or "pip" in p.lower() or "picture-in-picture" in p.lower()]

        highlights = []
        if overlays:
            highlights.append("placed video in Picture-in-Picture (PIP) on the Overlay track")
        if audio:
            highlights.append("isolated and leveled the audio track")
        if captions:
            highlights.append("generated synchronized subtitle captions from speech")
        if splits:
            highlights.append(f"divided your timeline into {len(splits) + 1} balanced scenes")
        if trans:
            highlights.append(f"connected the cut seams with dynamic transitions ({len(trans)})")
        if filters:
            highlights.append("color-graded the footage with atmospheric cinematic LUTs")
        if effects:
            highlights.append("added kinetic visual effects")

        action_phrase = ", ".join(highlights) if highlights else f"prepared {len(commands)} editing adjustments"

        if detected_tier == "beginner":
            summary_text = (
                f"🎬 All set! I have {action_phrase} to give your video a polished, engaging flow.\n\n"
                f"Review the plan below and click **Apply Plan** when you're ready to preview it on your timeline!"
            )
        elif detected_tier == "intermediate":
            summary_text = f"✓ Ready: {action_phrase} across {len(commands)} non-destructive timeline commands."
        else:
            summary_text = f"Sequence mapped: {action_phrase} ({len(commands)} edit commands prepared with verified handles and boundary checks)."

    return AIAssistantResponse(
        success=success,
        message=summary_text,
        responseText=summary_text,
        planSteps=plan_steps,
        requiresConfirmation=requires_conf,
        tool_calls=validated_tool_calls,
        commands=commands,
        validation_errors=errors,
        remaining_credits=remaining_credits,
        model_used=model_name,
        userTier=detected_tier
    )
