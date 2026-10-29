import subprocess

from app.core.config import settings
from app.engine.compiler import TimelineCompiler
from app.runners.probe_runner import ProbeRunner
from app.schemas.timeline import ClipSchema, TimelineExportRequest, TrackSchema


def create_video_with_audio(path):
    subprocess.run(
        [
            settings.get_ffmpeg_path(),
            "-y",
            "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=24",
            "-f", "lavfi", "-i", "sine=frequency=880:duration=2",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-pix_fmt", "yuv420p",
            str(path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def create_music_audio(path):
    subprocess.run(
        [
            settings.get_ffmpeg_path(),
            "-y",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
            "-c:a", "pcm_s16le",
            str(path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def test_muted_video_audio_is_skipped_without_removing_video(tmp_path):
    source = tmp_path / "source.mp4"
    output = tmp_path / "muted-video.mp4"
    create_video_with_audio(source)

    request = TimelineExportRequest(
        tracks=[
            TrackSchema(id="video", label="Video", type="video", clipIds=["video-clip"]),
        ],
        clips=[
            ClipSchema(
                id="video-clip",
                trackId="video",
                type="video",
                duration=2,
                mediaUrl=str(source),
                muted=True,
            ),
        ],
        fps=24,
        width=320,
        height=240,
        quality="draft",
    )

    command, _ = TimelineCompiler().compile(request, str(output))
    filter_graph = command[command.index("-filter_complex") + 1]
    assert "scale=" in filter_graph
    assert "aformat=" not in filter_graph

    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr

    import asyncio

    probe = asyncio.run(ProbeRunner.probe(str(output)))
    assert any(stream["codec_type"] == "video" for stream in probe["streams"])


def test_muted_audio_track_is_skipped(tmp_path):
    source = tmp_path / "source.mp4"
    create_video_with_audio(source)
    request = TimelineExportRequest(
        tracks=[
            TrackSchema(
                id="video",
                label="Video",
                type="video",
                clipIds=["video-clip"],
                muted=True,
            ),
        ],
        clips=[
            ClipSchema(
                id="video-clip",
                trackId="video",
                type="video",
                duration=2,
                mediaUrl=str(source),
            ),
        ],
        fps=24,
        width=320,
        height=240,
        quality="draft",
    )

    command, _ = TimelineCompiler().compile(request, str(tmp_path / "muted-track.mp4"))
    filter_graph = command[command.index("-filter_complex") + 1]
    assert "scale=" in filter_graph
    assert "aformat=" not in filter_graph


def test_mixed_video_and_music_audio_exports(tmp_path):
    source = tmp_path / "source-with-audio.mp4"
    music = tmp_path / "music.wav"
    output = tmp_path / "mixed.mp4"
    create_video_with_audio(source)
    create_music_audio(music)

    request = TimelineExportRequest(
        tracks=[
            TrackSchema(id="video", label="Video", type="video", clipIds=["video-clip"]),
            TrackSchema(id="music", label="Music", type="music", clipIds=["music-clip"]),
        ],
        clips=[
            ClipSchema(
                id="video-clip",
                trackId="video",
                type="video",
                duration=2,
                mediaUrl=str(source),
            ),
            ClipSchema(
                id="music-clip",
                trackId="music",
                type="audio",
                duration=2,
                mediaUrl=str(music),
            ),
        ],
        fps=24,
        width=320,
        height=240,
        quality="draft",
    )

    command, _ = TimelineCompiler().compile(request, str(output))
    filter_graph = command[command.index("-filter_complex") + 1]
    assert "amix=inputs=2" in filter_graph

    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    import asyncio

    probe = asyncio.run(ProbeRunner.probe(str(output)))
    stream_types = [stream["codec_type"] for stream in probe["streams"]]
    assert "video" in stream_types
    assert "audio" in stream_types


def test_audio_after_timeline_gap_is_audible_in_export(tmp_path):
    source = tmp_path / "music.wav"
    output = tmp_path / "music-after-gap.mp4"
    create_music_audio(source)

    request = TimelineExportRequest(
        tracks=[
            TrackSchema(id="video", label="Video", type="video", clipIds=[]),
            TrackSchema(
                id="audio",
                label="Audio",
                type="audio",
                clipIds=["early-music-clip", "music-clip"],
            ),
        ],
        clips=[
            ClipSchema(
                id="early-music-clip",
                trackId="audio",
                type="audio",
                start=0,
                duration=1,
                mediaUrl=str(source),
            ),
            ClipSchema(
                id="music-clip",
                trackId="audio",
                type="audio",
                start=5,
                duration=2,
                mediaUrl=str(source),
            ),
        ],
        fps=24,
        width=320,
        height=240,
        quality="draft",
    )

    command, duration = TimelineCompiler().compile(request, str(output))
    assert duration == 7

    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr

    import asyncio
    import math
    import struct

    probe = asyncio.run(ProbeRunner.probe(str(output)))
    assert float(probe["format"]["duration"]) >= 6.9

    decoded = subprocess.run(
        [
            settings.get_ffmpeg_path(),
            "-v", "error",
            "-ss", "5.25",
            "-i", str(output),
            "-t", "1",
            "-map", "0:a:0",
            "-f", "s16le",
            "-ac", "1",
            "-ar", "44100",
            "pipe:1",
        ],
        check=True,
        capture_output=True,
    )
    samples = struct.unpack(
        f"<{len(decoded.stdout) // 2}h",
        decoded.stdout[: len(decoded.stdout) // 2 * 2],
    )
    rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
    assert rms > 100, f"Expected audible audio after the timeline gap, got RMS {rms}"


def test_audio_upload_url_resolves_the_uploaded_asset_not_another_file(
    tmp_path, monkeypatch
):
    source = tmp_path / "uploaded-audio.wav"
    create_music_audio(source)
    monkeypatch.setattr("app.engine.compiler.settings.UPLOAD_DIR", tmp_path)

    resolved = TimelineCompiler()._resolve_media_path("/uploads/uploaded-audio.wav")

    assert resolved == str(source)


def test_missing_uploaded_audio_fails_instead_of_substituting_another_media_file(
    tmp_path, monkeypatch
):
    unrelated_video = tmp_path / "unrelated-video.mp4"
    unrelated_video.write_bytes(b"not audio")
    monkeypatch.setattr("app.engine.compiler.settings.UPLOAD_DIR", tmp_path)
    monkeypatch.setattr("app.engine.compiler.settings.STORAGE_DIR", tmp_path)

    import pytest

    with pytest.raises(FileNotFoundError, match="missing-audio.wav"):
        TimelineCompiler()._resolve_media_path("/uploads/missing-audio.wav")


def test_uploaded_audio_is_audible_in_export(tmp_path, monkeypatch):
    video = tmp_path / "source.mp4"
    audio = tmp_path / "uploaded-audio.wav"
    output = tmp_path / "uploaded-audio-export.mp4"
    create_video_with_audio(video)
    create_music_audio(audio)
    monkeypatch.setattr("app.engine.compiler.settings.UPLOAD_DIR", tmp_path)

    request = TimelineExportRequest(
        tracks=[
            TrackSchema(id="video", label="Video", type="video", clipIds=["video-clip"]),
            TrackSchema(id="audio", label="Audio", type="audio", clipIds=["audio-clip"]),
        ],
        clips=[
            ClipSchema(
                id="video-clip",
                trackId="video",
                type="video",
                duration=2,
                mediaUrl="/uploads/source.mp4",
            ),
            ClipSchema(
                id="audio-clip",
                trackId="audio",
                type="audio",
                duration=2,
                mediaUrl="/uploads/uploaded-audio.wav",
                volume=1,
                muted=False,
            ),
        ],
        fps=24,
        width=320,
        height=240,
        quality="draft",
    )

    command, _ = TimelineCompiler().compile(request, str(output))
    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr

    import math
    import struct

    decoded = subprocess.run(
        [
            settings.get_ffmpeg_path(),
            "-v", "error",
            "-i", str(output),
            "-t", "1",
            "-map", "0:a:0",
            "-f", "s16le",
            "-ac", "1",
            "-ar", "44100",
            "pipe:1",
        ],
        check=True,
        capture_output=True,
    )
    samples = struct.unpack(
        f"<{len(decoded.stdout) // 2}h",
        decoded.stdout[: len(decoded.stdout) // 2 * 2],
    )
    rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
    assert rms > 100, f"Expected audible uploaded audio, got RMS {rms}"
