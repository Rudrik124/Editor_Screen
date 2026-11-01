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

