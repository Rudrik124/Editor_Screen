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

def test_ai_assistant_timeout_handling(monkeypatch):
    from app.engine import ai_assistant_service
    from app.core.config import settings

    def mock_call_gemini(*args, **kwargs):
        raise TimeoutError("AI model request timed out")

    monkeypatch.setattr(ai_assistant_service, "call_gemini_conversational", mock_call_gemini)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test_key")

    req = AIAssistantPromptRequest(
        prompt="Make a very complex edit with 50 transitions",
        timelineState={
            "duration": 30.0,
            "clips": [{"id": "c1", "start": 0, "duration": 30}]
        }
    )

    res = ai_assistant_service.process_ai_assistant_request(req, remaining_credits=50)
    assert res.success is False
    assert "timed out" in res.message.lower()
    assert len(res.validation_errors) == 1
    assert "timed out" in res.validation_errors[0].lower()
