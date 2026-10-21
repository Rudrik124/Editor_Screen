from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema

def test_compiler_generates_valid_ffmpeg_command(tmp_path):
    compiler = TimelineCompiler()
    
    # Create fake media file
    dummy_video = tmp_path / "dummy.mp4"
    dummy_video.write_text("fake media content")

    request = TimelineExportRequest(
        projectId="proj-test",
        tracks=[
            TrackSchema(id="video", label="Video Spine", type="video", clipIds=["clip-1", "clip-2"])
        ],
        clips=[
            ClipSchema(
                id="clip-1",
                trackId="video",
                name="Intro",
                type="video",
                start=0.0,
                duration=4.0,
                inPoint=1.0,
                outPoint=5.0,
                speed=2.0,
                mediaUrl=str(dummy_video)
            ),
            ClipSchema(
                id="clip-2",
                trackId="video",
                name="Title",
                type="text",
                start=2.0,
                duration=3.0,
                textData={"content": "Welcome to Veytrix", "fontSize": 48}
            )
        ],
        fps=30,
        width=1280,
        height=720,
        quality="standard"
    )

    output_file = str(tmp_path / "output.mp4")
    cmd, duration = compiler.compile(request, output_file)

    assert duration >= 5.0
    assert "-filter_complex" in cmd
    assert "-c:v" in cmd
    assert "libx264" in cmd
    assert output_file in cmd

    # Verify filter complex contains canvas and scale
    filter_complex_idx = cmd.index("-filter_complex") + 1
    fc_str = cmd[filter_complex_idx]
    assert "color=c=black" in fc_str
    assert "1280x720" in fc_str
    assert "setpts" in fc_str  # Speed factor
    assert "overlay=" in fc_str
