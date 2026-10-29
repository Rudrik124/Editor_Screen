import pytest
from pydantic import ValidationError
from app.schemas.timeline import ClipSchema, TrackSchema, TimelineExportRequest

def test_valid_clip_schema():
    clip = ClipSchema(
        id="clip-1",
        trackId="track-1",
        name="Intro Clip",
        type="video",
        start=0.0,
        duration=5.5,
        speed=1.5,
        volume=1.2
    )
    assert clip.id == "clip-1"
    assert clip.duration == 5.5
    assert clip.speed == 1.5
    assert clip.muted is False

def test_clip_schema_accepts_muted_state():
    clip = ClipSchema(
        id="clip-muted",
        trackId="track-1",
        type="video",
        duration=2.0,
        muted=True
    )
    assert clip.muted is True

def test_clip_schema_rejects_negative_duration():
    with pytest.raises(ValidationError):
        ClipSchema(
            id="clip-bad",
            trackId="track-1",
            name="Bad Clip",
            type="video",
            start=0.0,
            duration=-2.0
        )

def test_clip_schema_rejects_invalid_speed():
    with pytest.raises(ValidationError):
        ClipSchema(
            id="clip-bad-speed",
            trackId="track-1",
            type="video",
            duration=4.0,
            speed=0.0  # Speed must be > 0.0
        )

def test_valid_timeline_export_request():
    req = TimelineExportRequest(
        projectId="proj-123",
        tracks=[
            TrackSchema(id="track-1", label="Main Track", type="video", clipIds=["clip-1"])
        ],
        clips=[
            ClipSchema(id="clip-1", trackId="track-1", name="Clip", type="video", start=0.0, duration=3.0)
        ],
        fps=60,
        width=1920,
        height=1080
    )
    assert req.fps == 60
    assert len(req.clips) == 1
