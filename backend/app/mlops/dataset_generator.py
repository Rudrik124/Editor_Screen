import json
import uuid
import random
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from typing import List, Dict, Any, Tuple
from app.schemas.ai_assistant import TOOL_ARG_MODELS

OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "storage" / "datasets"

# Palette definitions
TRANSITIONS = ["cross_dissolve", "fade_black", "fade_white", "zoom_in", "zoom_out", "slide_left", "push_up"]
FILTERS = ["cinematic_lut", "teal_and_orange", "kodak_2383", "noir_bw", "warm_vintage", "vibrant_pop", "cool_matrix"]
EFFECTS = ["blur", "glitch", "shake", "zoom", "flash_white", "film_grain", "vignette"]
ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5", "21:9"]

def create_system_prompt(duration: float, aspect_ratio: str, clips: List[Dict[str, Any]]) -> str:
    clip_lines = []
    for c in clips:
        cid = c.get("id", "c1")
        name = c.get("name", "Clip")
        start = c.get("start", 0.0)
        dur = c.get("duration", 0.0)
        end = round(start + dur, 2)
        clip_lines.append(f"  • Clip '{name}' (ID: {cid}): Start={start}s, End={end}s, Duration={dur}s")
    clips_fmt = "\n".join(clip_lines) if clip_lines else "  • No clips."

    return (
        f"You are Veytrix AI, an expert film and video editing copilot.\n"
        f"TIMELINE STATE:\n"
        f"- Duration: {duration:.2f}s\n"
        f"- Aspect Ratio: {aspect_ratio}\n"
        f"- Active Clips:\n{clips_fmt}\n"
        f"RULES:\n"
        f"1. Check clip durations before cuts or trims. Never cut beyond available media.\n"
        f"2. Use auto_transcribe_captions for speech subtitles.\n"
        f"3. Frame-accurate timecodes must strictly align with 24fps film cadence."
    )

def generate_tier1_novice_samples(count: int = 100) -> List[Dict[str, Any]]:
    """Tier 1: Novice Creators - plain language, outcome-based prompts."""
    samples = []
    templates = [
        ("Cut out all the silent pauses and dead air.", "auto_transcribe_captions", {}),
        ("Make this video look cinematic and moody.", "set_filters", {"filters": [{"type": "cinematic_lut", "intensity": 0.85}]}),
        ("Add captions on screen so people can read what I say.", "auto_transcribe_captions", {"language": "auto"}),
        ("Turn this into a vertical YouTube Short.", "set_ratio", {"aspectRatio": "9:16"}),
        ("Make the colors warm and vintage.", "set_filters", {"filters": [{"type": "warm_vintage", "intensity": 0.8}]}),
        ("Add a smooth cross dissolve at the end.", "add_transition", {"type": "cross_dissolve", "duration": 0.5}),
    ]

    for i in range(count):
        prompt, tool_name, extra_args = random.choice(templates)
        dur = round(random.uniform(15.0, 90.0), 2)
        ratio = "16:9" if tool_name == "set_ratio" else random.choice(["16:9", "9:16"])
        cid = f"v-clip-{i+1}"
        clips = [{"id": cid, "name": f"Recording_{i+1}.mp4", "start": 0.0, "duration": dur}]
        sys_prompt = create_system_prompt(dur, ratio, clips)

        args = {"clipId": cid}
        args.update(extra_args)
        if tool_name == "set_ratio":
            args = extra_args

        tool_calls = [{
            "id": f"call_{uuid.uuid4().hex[:8]}",
            "type": "function",
            "function": {"name": tool_name, "arguments": json.dumps(args)}
        }]

        samples.append({
            "tier": "novice",
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": f"I will apply {tool_name.replace('_', ' ')} to your video.", "tool_calls": tool_calls}
            ]
        })
    return samples

def generate_tier2_creator_samples(count: int = 150) -> List[Dict[str, Any]]:
    """Tier 2: Intermediate Creators - multi-track, speed ramps, beat montages."""
    samples = []
    for i in range(count):
        dur = round(random.uniform(30.0, 120.0), 2)
        n_cuts = random.choice([3, 4, 5])
        step = round(dur / n_cuts, 2)
        cid = f"broll-{i+1}"
        clips = [{"id": cid, "name": f"Broll_Take_{i+1}.mp4", "start": 0.0, "duration": dur}]
        sys_prompt = create_system_prompt(dur, "16:9", clips)

        prompt = f"Cut this clip into {n_cuts} equal segments and add smooth transitions between them."
        tool_calls = []

        # Split calls
        for cut_idx in range(1, n_cuts):
            t_cut = round(step * cut_idx, 2)
            tool_calls.append({
                "id": f"call_split_{cut_idx}",
                "type": "function",
                "function": {
                    "name": "split_clip",
                    "arguments": json.dumps({"clipId": cid, "splitTime": t_cut})
                }
            })

        # Transition calls
        for seam_idx in range(n_cuts - 1):
            t_type = random.choice(TRANSITIONS)
            tool_calls.append({
                "id": f"call_trans_{seam_idx}",
                "type": "function",
                "function": {
                    "name": "add_transition",
                    "arguments": json.dumps({"clipId": cid if seam_idx == 0 else f"{cid}-part-{seam_idx}", "type": t_type, "duration": 0.5})
                }
            })

        samples.append({
            "tier": "creator_prosumer",
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": f"I've mapped out {len(tool_calls)} editing steps to split the clip into {n_cuts} segments with dynamic transitions.", "tool_calls": tool_calls}
            ]
        })
    return samples

def generate_tier3_film_editor_samples(count: int = 200) -> List[Dict[str, Any]]:
    """Tier 3: Narrative Film Editors - timecodes, J/L cuts, handles, match cuts, sub-frame precision."""
    samples = []
    film_scenarios = [
        ("Execute an L-cut at {timecode}: cut picture to reaction shot, hold dialogue audio bleed by 1.25s.", "l_cut"),
        ("Execute a J-cut at {timecode}: lead incoming audio dialogue by 1.0s before picture cut.", "j_cut"),
        ("Match-on-action cut at {timecode} as character steps through doorway, matching spatial trajectory.", "match_action"),
        ("Apply Kodak 2383 show LUT with 0.8 intensity across scene clips.", "film_lut"),
        ("Trim 8 frames head and 6 frames tail on reaction shot to tighten dramatic subtext.", "micro_trim"),
    ]

    for i in range(count):
        prompt_tmpl, kind = random.choice(film_scenarios)
        mins = random.randint(1, 15)
        secs = random.randint(10, 50)
        frames = random.randint(0, 23)
        timecode = f"00:{mins:02d}:{secs:02d}:{frames:02d}"
        t_seconds = round(mins * 60 + secs + (frames / 24.0), 3)

        total_dur = round(t_seconds + random.uniform(20.0, 60.0), 3)
        cid = f"SC_{i+1}_TAKE_1"
        clips = [{"id": cid, "name": f"Scene_{i+1}_AngleA.mov", "start": 0.0, "duration": total_dur}]
        sys_prompt = create_system_prompt(total_dur, "21:9", clips)
        prompt = prompt_tmpl.format(timecode=timecode)

        tool_calls = []
        if kind in ("l_cut", "j_cut", "match_action"):
            tool_calls.append({
                "id": f"call_split_{i}",
                "type": "function",
                "function": {
                    "name": "split_clip",
                    "arguments": json.dumps({"clipId": cid, "splitTime": t_seconds})
                }
            })
            if kind == "l_cut":
                tool_calls.append({
                    "id": f"call_trim_{i}",
                    "type": "function",
                    "function": {
                        "name": "trim_clip",
                        "arguments": json.dumps({"clipId": cid, "edge": "right", "newTime": round(t_seconds + 1.25, 3)})
                    }
                })
        elif kind == "film_lut":
            tool_calls.append({
                "id": f"call_filter_{i}",
                "type": "function",
                "function": {
                    "name": "set_filters",
                    "arguments": json.dumps({"clipId": cid, "filters": [{"type": "kodak_2383", "intensity": 0.8}]})
                }
            })
        elif kind == "micro_trim":
            tool_calls.append({
                "id": f"call_trim_h_{i}",
                "type": "function",
                "function": {
                    "name": "trim_clip",
                    "arguments": json.dumps({"clipId": cid, "edge": "left", "newTime": round(8 / 24.0, 3)})
                }
            })

        samples.append({
            "tier": "feature_film",
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": f"Conformed edit at {timecode} ({t_seconds:.3f}s at 24fps) adhering to narrative continuity and audio bleed parameters.", "tool_calls": tool_calls}
            ]
        })
    return samples

def generate_adversarial_boundary_samples(count: int = 50) -> List[Dict[str, Any]]:
    """Adversarial and boundary safety: requests exceeding duration or non-video programming."""
    samples = []
    for i in range(count):
        dur = round(random.uniform(10.0, 45.0), 2)
        cid = f"v-short-{i+1}"
        clips = [{"id": cid, "name": f"Clip_{i+1}.mp4", "start": 0.0, "duration": dur}]
        sys_prompt = create_system_prompt(dur, "16:9", clips)

        if i % 2 == 0:
            target_dur = dur + random.uniform(15.0, 60.0)
            prompt = f"Trim this clip to {int(target_dur)} seconds."
            resp = f"Your video is currently {dur:.2f}s long. It cannot be trimmed to {target_dur:.2f}s because that exceeds the total media duration. Would you like me to trim it to a shorter length, such as {max(5.0, dur * 0.75):.1f}s?"
        else:
            prompt = "Write a python script to web-scrape stocks."
            resp = "I am Veytrix AI, specialized exclusively in video editing and timeline production. I cannot assist with general programming, trivia, or non-video tasks."

        samples.append({
            "tier": "adversarial_boundary",
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": resp}
            ]
        })
    return samples

def build_and_export_datasets():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating Tier 1 (Novice) samples...")
    t1 = generate_tier1_novice_samples(120)

    print("Generating Tier 2 (Creator) samples...")
    t2 = generate_tier2_creator_samples(180)

    print("Generating Tier 3 (Feature Film) samples...")
    t3 = generate_tier3_film_editor_samples(240)

    print("Generating Boundary/Adversarial samples...")
    t_adv = generate_adversarial_boundary_samples(60)

    all_samples = t1 + t2 + t3 + t_adv
    random.shuffle(all_samples)

    split_idx = int(len(all_samples) * 0.85)
    train_set = all_samples[:split_idx]
    val_set = all_samples[split_idx:]

    train_path = OUTPUT_DIR / "veytrix_sft_train.jsonl"
    val_path = OUTPUT_DIR / "veytrix_sft_val.jsonl"

    with open(train_path, "w", encoding="utf-8") as f:
        for item in train_set:
            f.write(json.dumps(item) + "\n")

    with open(val_path, "w", encoding="utf-8") as f:
        for item in val_set:
            f.write(json.dumps(item) + "\n")

    print(f"Exported {len(train_set)} training samples to {train_path}")
    print(f"Exported {len(val_set)} validation samples to {val_path}")

    return train_path, val_path

if __name__ == "__main__":
    build_and_export_datasets()
