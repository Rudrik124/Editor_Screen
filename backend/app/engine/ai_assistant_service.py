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
from app.engine.timeline_simulator import TimelineSimulator
from app.schemas.ai_assistant import (
    AIAssistantPromptRequest,
    AIAssistantResponse,
    ToolCallRequestItem,
    EditorCommandSchema
)

logger = logging.getLogger("veytrix.ai_assistant")

SYSTEM_PERSONA_PROMPT = """You are Veytrix AI, an intelligent, professional video editing copilot dedicated solely to Veytrix Video Editor and video production.

DOMAIN SCOPE & STRICT BOUNDARIES:
- You ONLY assist with video editing, timeline operations, cinematography, pacing, transitions, color grading, audio mixing, subtitles, visual effects, and using Veytrix Editor features.
- You MUST REFUSE any general queries outside video editing and video production (such as writing general Python code, solving math homework, answering politics/history questions, coding unrelated software, or general trivia).
- When a user asks an out-of-scope question (e.g. "write python code", "what is the capital of France", "write an essay"), respond politely and concisely:
  "I am Veytrix AI, specialized exclusively in video editing and timeline production. I cannot assist with general programming, trivia, or non-video tasks. Let me know if you need help trimming clips, adding transitions, color grading, or editing your project!"

TIMELINE STATE MANIFEST:
- Total Project Duration: {duration}s ({duration_formatted})
- Canvas Aspect Ratio: {aspect_ratio}
- Current Playhead Position: {current_time}s
- Selected Clip ID: {selected_clip}
- Active Clips on Timeline:
{clips_formatted}

CRITICAL EDITORIAL & BOUNDARY RULES:
1. Video Awareness & Boundary Checking:
   - Always check the exact duration of the clips on the timeline before applying any trims, cuts, or splits.
   - If the user asks to trim or cut to a duration that is GREATER than the clip's actual length (for example, asking to trim to 1.50 mins / 90s when the video is only {duration}s / {duration_formatted}):
     DO NOT CALL ANY TOOL!
     Explain clearly:
     "The current video is {duration}s ({duration_formatted}) long, which is shorter than the requested duration. It cannot be trimmed to that length. Would you like me to trim it to a shorter duration, such as 45 seconds or 1 minute?"
   - If the user asks to split a clip outside its time boundaries (for example, split from 1 min 25s to 2 mins when the clip ends at {duration}s):
     DO NOT CALL ANY TOOL! Explain that the requested timestamp is beyond the end of the video.
2. Captions and Subtitles:
   - When the user asks to "add captions", "add subtitles", "transcribe audio", or "create subtitles from speech":
     CALL `auto_transcribe_captions`!
     NEVER hallucinate dummy placeholder sentences with `add_caption` unless the user explicitly dictates the exact custom text to display.
3. Splitting into N clips:
   - Calculate step = total_duration / N.
   - Issue (N - 1) split_clip calls at chronological cut timestamps (step * 1, step * 2, ..., step * (N-1)).
   - Distribute transitions across the cut seams between contiguous clips.
4. Explaining your actions:
   - Provide a clear, natural language plan alongside any tool calls.
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

def build_system_instruction(req: AIAssistantPromptRequest) -> str:
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
            clip_lines.append(
                f"  • Clip '{cname}' (ID: {cid}): Start={cstart}s, End={cend}s, Duration={cdur}s ({format_duration(cdur)})"
            )

    clips_formatted = "\n".join(clip_lines) if clip_lines else "  • No clips on timeline."

    return SYSTEM_PERSONA_PROMPT.format(
        duration=duration,
        duration_formatted=format_duration(duration),
        aspect_ratio=aspect_ratio,
        current_time=current_time,
        selected_clip=selected_clip,
        clips_formatted=clips_formatted
    )

def handle_intelligent_conversational_turn(
    prompt: str,
    req: AIAssistantPromptRequest,
    remaining_credits: int,
    model_name: str
) -> Optional[AIAssistantResponse]:
    """
    Evaluates prompt for out-of-scope queries, impossible duration boundaries,
    and direct video editing instructions.
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

    # 2. Boundary Check: "trim ... to X"
    if "trim" in p_lower:
        parsed_target = parse_time_expression(prompt)
        if parsed_target is not None:
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
            else:
                # Valid trim within bounds
                new_time = round(parsed_target, 2)
                plan = [f"Trim right edge of clip to {new_time}s"]
                cmd = tool_call_to_editor_command("trim_clip", {
                    "clipId": clip_id,
                    "edge": "right",
                    "newTime": new_time
                })
                resp_text = f"I will trim the video to {new_time} seconds ({format_duration(new_time)})."
                return AIAssistantResponse(
                    success=True,
                    message=resp_text,
                    responseText=resp_text,
                    planSteps=plan,
                    requiresConfirmation=False,
                    tool_calls=[ToolCallRequestItem(name="trim_clip", args={"clipId": clip_id, "edge": "right", "newTime": new_time})],
                    commands=[cmd],
                    validation_errors=[],
                    remaining_credits=remaining_credits,
                    model_used=model_name
                )

    # 3. Boundary Check: "split ... from X to Y"
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

    # 4. Captions & Subtitles
    if any(k in p_lower for k in ["caption", "subtitle", "transcribe", "subtitles", "captions"]):
        plan = ["Transcribe spoken audio dialogue into word-synchronized subtitle captions on the timeline"]
        tool_item = ToolCallRequestItem(
            name="auto_transcribe_captions",
            args={"clipId": clip_id, "language": "auto"}
        )
        cmd = tool_call_to_editor_command("auto_transcribe_captions", {"clipId": clip_id, "language": "auto"})
        resp_text = (
            "I'm transcribing the audio dialogue in your video and generating synchronized subtitle captions for your timeline."
        )
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
            model_used=model_name
        )

    # 5. Multi-Split into N clips (e.g. "split into 5 clips, and different transitions")
    m_split_n = re.search(r"split.*into\s*(\d+)\s*clips?", p_lower)
    if m_split_n:
        n_clips = max(2, min(10, int(m_split_n.group(1))))
        effective_dur = clip_dur if clip_dur > 0 else total_dur
        step = effective_dur / n_clips

        simulator = TimelineSimulator(state)
        palette = ["cross_dissolve", "fade_black", "zoom_in", "slide_left", "push_up", "fade_white"]
        commands: List[EditorCommandSchema] = []
        tool_items: List[ToolCallRequestItem] = []
        plan: List[str] = []

        # Issue (n_clips - 1) splits
        for i in range(1, n_clips):
            split_at = round(step * i, 2)
            part_id = f"clip-part-{uuid.uuid4().hex[:6]}"
            sim_ok, target_cid, _ = simulator.split_clip(clip_id, split_at, part_id)
            actual_cid = target_cid or clip_id

            split_args = {"clipId": actual_cid, "splitTime": split_at, "newClipId": part_id}
            tool_items.append(ToolCallRequestItem(name="split_clip", args=split_args))
            commands.append(tool_call_to_editor_command("split_clip", split_args))
            plan.append(f"Cut clip at {split_at}s")

        # If transitions requested
        if "transition" in p_lower:
            sim_clips = simulator.get_all_clip_ids()
            seam_clips = sim_clips[:-1]
            for i, cid in enumerate(seam_clips):
                t_type = palette[i % len(palette)]
                t_args = {"clipId": cid, "type": t_type, "duration": 0.5}
                tool_items.append(ToolCallRequestItem(name="add_transition", args=t_args))
                commands.append(tool_call_to_editor_command("add_transition", t_args))
                plan.append(f"Apply '{t_type}' transition between segment {i+1} and {i+2}")

        resp_text = f"I've planned out {len(commands)} editing steps to split the video into {n_clips} segments with smooth transitions between them."
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
            model_used=model_name
        )

    return None

def call_gemini_conversational(
    prompt: str,
    system_instruction: str,
    conversation_history: List[Any],
    api_key: str,
    model_name: str
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
        with urllib.request.urlopen(req, timeout=20) as response:
            res_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Gemini API HTTP Error {e.code}: {error_body}")
        raise RuntimeError(f"Gemini API returned HTTP {e.code}: {error_body}")
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

    # Pre-validation: intelligent boundaries & domain check
    smart_turn = handle_intelligent_conversational_turn(
        prompt=req.prompt,
        req=req,
        remaining_credits=remaining_credits,
        model_name=model_name
    )
    if smart_turn is not None:
        return smart_turn

    system_prompt = build_system_instruction(req)

    raw_tool_calls: List[Dict[str, Any]] = []
    response_text = ""

    if api_key:
        try:
            response_text, raw_tool_calls = call_gemini_conversational(
                prompt=req.prompt,
                system_instruction=system_prompt,
                conversation_history=req.conversationHistory or [],
                api_key=api_key,
                model_name=model_name
            )
        except Exception as e:
            logger.warning(f"Live Gemini API unavailable, processing with conversational director: {e}")

    # If conversational query with no tool calls
    if not raw_tool_calls:
        fallback_reply = response_text or "I reviewed your timeline. How would you like me to adjust your edit?"
        return AIAssistantResponse(
            success=True,
            message=fallback_reply,
            responseText=fallback_reply,
            planSteps=[],
            requiresConfirmation=False,
            tool_calls=[],
            commands=[],
            validation_errors=[],
            remaining_credits=remaining_credits,
            model_used=model_name
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
            if sim_ok and actual_cid:
                args["clipId"] = actual_cid

            plan_steps.append(f"Cut clip at {round(split_time, 2)}s")

        elif name == "trim_clip":
            end_val = args.get("end") or args.get("duration") or 0.0
            plan_steps.append(f"Trim clip boundary to {round(float(end_val), 2)}s")

        elif name == "auto_transcribe_captions":
            plan_steps.append("Transcribe spoken audio dialogue to subtitles")

        elif name == "add_transition":
            plan_steps.append(f"Add {args.get('type', 'cross_dissolve')} transition to clip")

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

    # Distribute transitions across seams
    user_prompt_lower = req.prompt.lower()
    all_sim_clip_ids = simulator.get_all_clip_ids()
    if "transition" in user_prompt_lower and len(all_sim_clip_ids) > 1:
        commands = [c for c in commands if c.type != "ADD_TRANSITION"]
        validated_tool_calls = [c for c in validated_tool_calls if c.name != "add_transition"]
        plan_steps = [s for s in plan_steps if "transition" not in s.lower()]

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

    summary_text = response_text or f"I've mapped out {len(commands)} editing step(s) to achieve this:"

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
        model_used=model_name
    )
