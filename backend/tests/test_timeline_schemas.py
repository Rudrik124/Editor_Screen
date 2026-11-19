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


@pytest.mark.parametrize(
    "preset, ratio, expected",
    [
        ("720p", "16:9", (1280, 720)),
        ("720p", "9:16", (720, 1280)),
        ("720p", "1:1", (720, 720)),
        ("720p", "4:5", (576, 720)),
        ("720p", "21:9", (1680, 720)),
        ("1080p", "16:9", (1920, 1080)),
        ("1080p", "9:16", (1080, 1920)),
        ("1080p", "1:1", (1080, 1080)),
        ("1080p", "4:5", (864, 1080)),
        ("1080p", "21:9", (2520, 1080)),
        ("4k", "16:9", (3840, 2160)),
        ("4k", "9:16", (2160, 3840)),
        ("4k", "1:1", (2160, 2160)),
        ("4k", "4:5", (1728, 2160)),
        ("4k", "21:9", (3840, 1646)),
    ],
)
def test_resolution_preset_resolves_exact_dimensions(preset, ratio, expected):
    request = TimelineExportRequest(tracks=[], clips=[], resolutionPreset=preset, aspectRatio=ratio)
    assert (request.width, request.height) == expected


@pytest.mark.parametrize(
    "fields, expected",
    [({}, (1920, 1080)), ({"width": 640, "height": 360, "quality": "draft"}, (640, 360))],
)
def test_legacy_export_dimensions(fields, expected):
    request = TimelineExportRequest(tracks=[], clips=[], **fields)
    assert (request.width, request.height) == expected


def test_preset_accepts_matching_explicit_dimensions():
    request = TimelineExportRequest(
        tracks=[], clips=[], resolutionPreset="4k", aspectRatio="9:16", width=2160, height=3840
    )
    assert (request.width, request.height) == (2160, 3840)


@pytest.mark.parametrize(
    "fields, message",
    [
        ({"resolutionPreset": "720p"}, "must be provided together"),
        ({"aspectRatio": "16:9"}, "must be provided together"),
        ({"resolutionPreset": "720p", "aspectRatio": "16:9", "width": 1920}, "must match"),
        ({"resolutionPreset": "4k", "aspectRatio": "9:16", "height": 2160}, "must match"),
        ({"width": 2160, "height": 3840}, "at most 2160"),
    ],
)
def test_invalid_export_dimension_requests(fields, message):
    with pytest.raises(ValidationError, match=message):
        TimelineExportRequest(tracks=[], clips=[], **fields)
