import pytest
from app.engine.ai_assistant_service import process_ai_assistant_request
from app.schemas.ai_assistant import AIAssistantPromptRequest, ChatMessageSchema
from app.engine.timeline_simulator import TimelineSimulator

def test_timeline_simulator_multi_cut():
    initial_state = {
        "clips": {
            "c1": {"id": "c1", "start": 0.0, "duration": 100.0, "name": "Main Clip"}
        }
    }
    sim = TimelineSimulator(initial_state)

    # Cut at 25s
    ok1, act1, r1 = sim.split_clip("c1", 25.0, "c1-p2")
    assert ok1 is True
    assert sim.clips["c1"]["duration"] == 25.0
    assert sim.clips["c1-p2"]["start"] == 25.0
    assert sim.clips["c1-p2"]["duration"] == 75.0

    # Cut at 50s (even if caller references 'c1', simulator finds containing segment c1-p2)
    ok2, act2, r2 = sim.split_clip("c1", 50.0, "c1-p3")
    assert ok2 is True
    assert act2 == "c1-p2"
    assert sim.clips["c1-p2"]["duration"] == 25.0
    assert sim.clips["c1-p3"]["start"] == 50.0
    assert sim.clips["c1-p3"]["duration"] == 50.0

    assert len(sim.get_all_clip_ids()) == 3

def test_refuse_out_of_scope_query():
    req = AIAssistantPromptRequest(
        prompt="Write a python code to print 10 numbers",
        timelineState={
            "duration": 60.0,
            "aspectRatio": "16:9",
            "clips": {}
        }
    )
    res = process_ai_assistant_request(req)
    assert res.success is True
    assert len(res.commands) == 0
    # Must refuse non-video queries
    assert "video editing" in res.responseText.lower() or "exclusively" in res.responseText.lower() or "cannot assist" in res.responseText.lower()
