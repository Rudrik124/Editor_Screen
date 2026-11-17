import pytest
from app.engine.ai_assistant_service import process_ai_assistant_request
from app.schemas.ai_assistant import AIAssistantPromptRequest

@pytest.fixture
def sample_timeline():
    return {
        "duration": 72.47,
        "aspectRatio": "16:9",
        "currentTime": 0.0,
        "clips": {
            "clip-1": {
                "id": "clip-1",
                "name": "WhatsApp Video 2026-10-27 at 12.55.47 AM.mp4",
                "start": 0.0,
                "duration": 72.47,
                "type": "video"
            }
        }
    }

def test_trim_past_duration_refuses_politely(sample_timeline):
    req = AIAssistantPromptRequest(
        prompt="Trim the video to 1.50 mins",
        timelineState=sample_timeline
    )
    res = process_ai_assistant_request(req)
    assert res.success is True
    assert len(res.commands) == 0
    # Must warn the user that 72.47s is shorter than 1.50 mins
    assert "72.47" in res.responseText or "1 minute 12" in res.responseText
    assert "exceeds" in res.responseText or "cannot be trimmed" in res.responseText

def test_split_past_duration_refuses_politely(sample_timeline):
    req = AIAssistantPromptRequest(
        prompt="split the video from 1 min 25 seconds to 2 mins",
        timelineState=sample_timeline
    )
    res = process_ai_assistant_request(req)
    assert res.success is True
    assert len(res.commands) == 0
    assert "beyond the end" in res.responseText or "72.47" in res.responseText

def test_auto_transcribe_captions_command(sample_timeline):
    req = AIAssistantPromptRequest(
        prompt="add captions and subtitle to the video",
        timelineState=sample_timeline
    )
    res = process_ai_assistant_request(req)
    assert res.success is True
    assert len(res.commands) == 1
    assert res.commands[0].type == "AUTO_TRANSCRIBE_CAPTIONS"
    assert "transcribing" in res.responseText.lower() or "subtitle" in res.responseText.lower()

def test_split_5_clips_with_transitions(sample_timeline):
    req = AIAssistantPromptRequest(
        prompt="Split the video into 5 clips, and different transitions for each clips",
        timelineState=sample_timeline
    )
    res = process_ai_assistant_request(req)
    assert res.success is True
    # 4 splits + 4 transitions = 8 commands
    assert len(res.commands) == 8
    splits = [c for c in res.commands if c.type == "SPLIT_CLIP"]
    trans = [c for c in res.commands if c.type == "ADD_TRANSITION"]
    assert len(splits) == 4
    assert len(trans) == 4

def test_refuse_python_coding(sample_timeline):
    req = AIAssistantPromptRequest(
        prompt="Write a python code to print 10 numbers",
        timelineState=sample_timeline
    )
    res = process_ai_assistant_request(req)
    assert res.success is True
    assert len(res.commands) == 0
    assert "exclusively" in res.responseText.lower() or "video editing" in res.responseText.lower()

def test_affirmative_proceed_prompt(sample_timeline):
    req = AIAssistantPromptRequest(
        prompt="proceed with plan",
        timelineState=sample_timeline
    )
    res = process_ai_assistant_request(req)
    assert res.success is True
    assert "proceed" in res.responseText.lower() or "apply plan" in res.responseText.lower()

def test_mlops_dataset_evaluation():
    from pathlib import Path
    from app.mlops.evaluator import evaluate_dataset_integrity

    val_path = Path(__file__).resolve().parent.parent / "storage" / "datasets" / "veytrix_sft_val.jsonl"
    if val_path.exists():
        metrics = evaluate_dataset_integrity(val_path)
        assert metrics["total_dialogues"] > 0
        assert metrics["schema_pass_rate_pct"] == 100.0
        assert "feature_film" in metrics["tier_distribution"]
        assert "creator_prosumer" in metrics["tier_distribution"]
        assert "novice" in metrics["tier_distribution"]
