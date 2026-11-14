import pytest
from app.engine.ai_assistant_validator import (
    validate_tool_call,
    tool_call_to_editor_command
)
from app.schemas.ai_assistant import AIAssistantPromptRequest
from app.engine.ai_assistant_service import build_system_instruction

def test_validate_trim_clip():
    timeline = {
        "clips": {
            "c1": {"id": "c1", "start": 0.0, "duration": 10.0}
        }
    }
    # Valid trim
    valid, err, val_args = validate_tool_call(
        "trim_clip",
        {"clipId": "c1", "start": 0.0, "end": 5.0},
        timeline
    )
    assert valid is True
    assert val_args["end"] == 5.0

    # Invalid trim (end <= start)
    valid, err, _ = validate_tool_call(
        "trim_clip",
        {"clipId": "c1", "start": 5.0, "end": 2.0},
        timeline
    )
    assert valid is False
    assert "greater than start" in err

def test_validate_split_clip():
    timeline = {
        "clips": {
            "c1": {"id": "c1", "start": 2.0, "duration": 8.0}
        }
    }
    # Valid split
    valid, err, val_args = validate_tool_call(
        "split_clip",
        {"clipId": "c1", "splitTime": 5.0},
        timeline
    )
    assert valid is True
    assert val_args["splitTime"] == 5.0

def test_tool_call_to_editor_command():
    cmd = tool_call_to_editor_command("add_transition", {
        "clipId": "c1",
        "type": "cross_dissolve",
        "duration": 0.8
    })
    assert cmd.type == "ADD_TRANSITION"
    assert cmd.payload["clipId"] == "c1"
    assert cmd.payload["transition"]["type"] == "cross_dissolve"
    assert cmd.payload["transition"]["duration"] == 0.8

def test_build_system_instruction():
    req = AIAssistantPromptRequest(
        prompt="trim clip to 5s",
        timelineState={
            "duration": 10.0,
            "aspectRatio": "16:9",
            "clips": [{"id": "c1", "name": "Intro", "type": "video", "start": 0, "duration": 10}]
        },
        selectedClipId="c1"
    )
    prompt = build_system_instruction(req)
    assert "Veytrix AI" in prompt
    assert "Intro" in prompt
    assert "c1" in prompt
