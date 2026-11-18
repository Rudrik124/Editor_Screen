import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.credit_repository import _DEV_CREDIT_CACHE, get_user_credits

client = TestClient(app)

def test_conversational_and_out_of_scope_cost_zero_credits():
    user_id = "test_user_credit_eval"
    _DEV_CREDIT_CACHE[user_id] = 20

    # 1. Ask general question / non-editing question
    payload = {
        "prompt": "How do I make my video pacing feel faster?",
        "timelineState": {
            "duration": 45.0,
            "aspectRatio": "16:9",
            "clips": {
                "c1": {"id": "c1", "start": 0.0, "duration": 45.0, "name": "Vlog"}
            }
        },
        "userId": user_id
    }

    res = client.post("/api/v1/ai/assistant", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["commands"]) == 0
    assert data["credits_charged"] == 0
    assert data["remaining_credits"] == 20
    assert get_user_credits(user_id) == 20

def test_out_of_bounds_trim_costs_zero_credits():
    user_id = "test_user_boundary"
    _DEV_CREDIT_CACHE[user_id] = 20

    # Asking to trim video to 90s when it's only 45s
    payload = {
        "prompt": "trim video to 90 seconds",
        "timelineState": {
            "duration": 45.0,
            "aspectRatio": "16:9",
            "clips": {
                "c1": {"id": "c1", "start": 0.0, "duration": 45.0, "name": "Short Video"}
            }
        },
        "userId": user_id
    }

    res = client.post("/api/v1/ai/assistant", json=payload)
    assert res.status_code == 200
    data = res.json()
    # Boundary warning, 0 edits applied, 0 credits charged!
    assert len(data["commands"]) == 0
    assert data["credits_charged"] == 0
    assert data["remaining_credits"] == 20
    assert get_user_credits(user_id) == 20

def test_actual_work_applied_costs_one_credit():
    user_id = "test_user_actual_edit"
    _DEV_CREDIT_CACHE[user_id] = 20

    # Actual valid operation that generates commands (e.g. Instagram Reels 9:16 aspect ratio)
    payload = {
        "prompt": "make it vertical for instagram reels",
        "timelineState": {
            "duration": 45.0,
            "aspectRatio": "16:9",
            "clips": {
                "c1": {"id": "c1", "start": 0.0, "duration": 45.0, "name": "Clip 1"}
            }
        },
        "userId": user_id
    }

    res = client.post("/api/v1/ai/assistant", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["commands"]) > 0
    # Actual work done -> exactly 1 credit charged
    assert data["credits_charged"] == 1
    assert data["remaining_credits"] == 19
    assert get_user_credits(user_id) == 19
