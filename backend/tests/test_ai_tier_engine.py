import pytest
from app.engine.ai_tier_engine import (
    detect_user_tier,
    smpte_timecode_to_seconds,
    db_to_linear_gain,
    parse_db_expression,
    parse_frames_expression
)
from app.engine.ai_assistant_service import process_ai_assistant_request
from app.schemas.ai_assistant import AIAssistantPromptRequest, ChatMessageSchema

def test_tier_detection():
    # Beginner: casual, colloquial phrasing
    t_beg = detect_user_tier(["how do i make my video shorter?", "make it look cool please"])
    assert t_beg == "beginner"

    # Intermediate: transition, keyframe, lower third
    t_int = detect_user_tier(["add a zoom transition between clip 1 and 2", "keyframe the opacity"])
    assert t_int == "intermediate"

    # Professional: J-cut, LUT, SMPTE, timecode, LUFS
    t_pro1 = detect_user_tier(["L-cut at 00:01:24:12 with audio 10 frames early"])
    assert t_pro1 == "professional"

    t_pro2 = detect_user_tier(["normalize V1 to -23 LUFS and stack Rec.709 LUT"])
    assert t_pro2 == "professional"

def test_smpte_and_math_helpers():
    # 01:00:10:12 at 24 fps = 3600 + 10 + 12/24 = 3610.5s
    s_24 = smpte_timecode_to_seconds("01:00:10:12", fps=24.0)
    assert s_24 == 3610.5

    # 00:00:08:15 at 30 fps = 8 + 0.5 = 8.5s
    s_30 = smpte_timecode_to_seconds("00:00:08:15", fps=30.0)
    assert s_30 == 8.5

    # Decibel conversions
    assert db_to_linear_gain(0.0) == 1.0
    assert abs(db_to_linear_gain(-6.0) - 0.5012) < 0.01
    assert abs(db_to_linear_gain(-18.0) - 0.1259) < 0.01
    assert abs(db_to_linear_gain(-42.0) - 0.0079) < 0.005

    # Parse decibel from string
    assert abs(parse_db_expression("set music to -18dB") - 0.1259) < 0.01

    # Parse frames
    assert parse_frames_expression("pull 12 frames from head", fps=24.0) == 0.5

def test_end_to_end_user_tier_flow():
    # When user uses professional vocabulary, response detects tier as professional
    req = AIAssistantPromptRequest(
        prompt="Apply a Rec.709 normalization LUT and create an L-cut with sync dialogue",
        timelineState={
            "duration": 60.0,
            "aspectRatio": "16:9",
            "clips": {
                "c1": {"id": "c1", "start": 0.0, "duration": 30.0, "name": "A-Roll"},
                "c2": {"id": "c2", "start": 30.0, "duration": 30.0, "name": "B-Roll"}
            }
        }
    )
    res = process_ai_assistant_request(req)
    assert res.userTier == "professional"
