import pytest
from app.engine.ai_fallback_director import run_fallback_director
from app.schemas.ai_assistant import AIAssistantPromptRequest

@pytest.fixture
def test_timeline():
    return {
        "duration": 60.0,
        "aspectRatio": "16:9",
        "currentTime": 5.0,
        "clips": {
            "clip-1": {
                "id": "clip-1",
                "name": "Interview.mp4",
                "start": 0.0,
                "duration": 60.0,
                "type": "video"
            }
        }
    }

def test_fallback_music_too_loud(test_timeline):
    req = AIAssistantPromptRequest(prompt="the music is too loud, turn it down", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "beginner", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "SET_AUDIO_VOLUME"
    assert res.commands[0].payload["volume"] == 0.25

def test_fallback_instagram_reels_ratio(test_timeline):
    req = AIAssistantPromptRequest(prompt="make it vertical for instagram reels", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "beginner", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "SET_RATIO"
    assert res.commands[0].payload["aspectRatio"] == "9:16"

def test_fallback_mute_clip(test_timeline):
    req = AIAssistantPromptRequest(prompt="mute the video clip", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "beginner", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "MUTE_CLIP"
    assert res.commands[0].payload["muted"] is True

def test_fallback_swipe_left_transition(test_timeline):
    req = AIAssistantPromptRequest(prompt="add swipe left transition", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "intermediate", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "ADD_TRANSITION"
    assert res.commands[0].payload["transition"]["type"] == "slide_left"

def test_fallback_cross_dissolve(test_timeline):
    req = AIAssistantPromptRequest(prompt="add a cross dissolve", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "intermediate", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "ADD_TRANSITION"
    assert res.commands[0].payload["transition"]["type"] == "cross_dissolve"

def test_fallback_speed_up_2x(test_timeline):
    req = AIAssistantPromptRequest(prompt="speed it up 2x", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "intermediate", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "SET_SPEED"
    assert res.commands[0].payload["speed"] == 2.0

def test_fallback_reverse_clip(test_timeline):
    req = AIAssistantPromptRequest(prompt="reverse the clip", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "intermediate", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "REVERSE_CLIP"

def test_fallback_freeze_frame(test_timeline):
    req = AIAssistantPromptRequest(prompt="freeze on this frame for 2 seconds", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "intermediate", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "FREEZE_CLIP"
    assert res.commands[0].payload["duration"] == 2.0
    assert res.commands[0].payload["freezeTime"] == 5.0

def test_fallback_decibel_volume(test_timeline):
    req = AIAssistantPromptRequest(prompt="set audio volume to -18dB", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "professional", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "SET_AUDIO_VOLUME"
    assert abs(res.commands[0].payload["volume"] - 0.1259) < 0.01

def test_fallback_cinematic_filter(test_timeline):
    req = AIAssistantPromptRequest(prompt="apply a cinematic filter", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "beginner", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "SET_FILTERS"
    assert res.commands[0].payload["filters"][0]["type"] == "cinematic_lut"

def test_fallback_black_and_white(test_timeline):
    req = AIAssistantPromptRequest(prompt="make it black and white", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "beginner", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "SET_FILTERS"
    assert res.commands[0].payload["filters"][0]["type"] == "noir_bw"

def test_fallback_vhs_effect(test_timeline):
    req = AIAssistantPromptRequest(prompt="add a retro vhs glitch effect", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "intermediate", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "SET_EFFECTS"
    assert res.commands[0].payload["effects"][0]["type"] == "vhs_classic"

def test_fallback_undo(test_timeline):
    req = AIAssistantPromptRequest(prompt="undo last change", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "beginner", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "UNDO"

def test_fallback_duplicate(test_timeline):
    req = AIAssistantPromptRequest(prompt="duplicate this clip", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "intermediate", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "DUPLICATE_CLIP"

def test_fallback_pip(test_timeline):
    req = AIAssistantPromptRequest(prompt="add this clip to pip or overlay", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "intermediate", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "SET_OVERLAP"
    assert res.commands[0].payload["trackId"] == "overlay-clip"
    assert res.commands[0].payload["scale"] == 0.4

def test_fallback_refuse_python(test_timeline):
    req = AIAssistantPromptRequest(prompt="write python code to sort a list", timelineState=test_timeline)
    res = run_fallback_director(req.prompt, req, "beginner", 50, "test-model")
    assert res.success is True
    assert len(res.commands) == 0
    assert "exclusively" in res.responseText.lower() or "video editing" in res.responseText.lower()
