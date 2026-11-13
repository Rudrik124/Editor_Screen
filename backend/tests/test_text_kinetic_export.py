import pytest
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema

def test_text_subtitles_export_compiles_kinetic_fade_and_slide():
    compiler = TimelineCompiler()
    request = TimelineExportRequest(
        tracks=[
            TrackSchema(id="t_text", label="Text Track", type="text", clipIds=["c_text"])
        ],
        clips=[
            ClipSchema(
                id="c_text",
                trackId="t_text",
                start=0.0,
                duration=3.0,
                type="text",
                textData={
                    "content": "Kinetic Title",
                    "fontSize": 48,
                    "color": "yellow",
                    "x": 50,
                    "y": 80,
                    "preset": "fade_in"
                }
            )
        ]
    )

    cmd, duration = compiler.compile(request, "output_text.mp4")
    fc_idx = cmd.index("-filter_complex") + 1
    fc = cmd[fc_idx]

    assert "drawtext" in fc
    assert "Kinetic Title" in fc
    assert "fontsize=48" in fc
    assert "fontcolor=yellow" in fc
    assert "min(1.0,t/0.6)" in fc


def test_multiple_captions_export_compiles_timed_overlays():
    compiler = TimelineCompiler()
    request = TimelineExportRequest(
        tracks=[
            TrackSchema(id="video", label="Video Track", type="video", clipIds=["v1"]),
            TrackSchema(id="text", label="Captions", type="text", clipIds=["cap1", "cap2"])
        ],
        clips=[
            ClipSchema(
                id="v1",
                trackId="video",
                start=0.0,
                duration=6.0,
                type="video",
            ),
            ClipSchema(
                id="cap1",
                trackId="text",
                start=0.5,
                duration=2.0,
                type="text",
                textData={
                    "text": "Hello world caption",
                    "fontSize": 28,
                    "color": "#FFFFFF",
                    "x": 50,
                    "y": 85
                }
            ),
            ClipSchema(
                id="cap2",
                trackId="text",
                start=3.0,
                duration=2.5,
                type="text",
                textData={
                    "text": "Second line of subtitle",
                    "fontSize": 30,
                    "color": "#00FFCC",
                    "x": 50,
                    "y": 85
                }
            )
        ]
    )

    cmd, duration = compiler.compile(request, "output_captioned.mp4")
    fc_idx = cmd.index("-filter_complex") + 1
    fc = cmd[fc_idx]

    # Verify both captions are compiled into drawtext filters
    assert "Hello world caption" in fc
    assert "Second line of subtitle" in fc
    # Verify hex color converted to 0x format for FFmpeg
    assert "fontcolor=0xFFFFFF" in fc
    assert "fontcolor=0x00FFCC" in fc
    # Verify timed overlay intervals for both captions
    assert "between(t,0.5,2.5)" in fc
    assert "between(t,3.0,5.5)" in fc
    # Verify duration
    assert duration >= 5.5


