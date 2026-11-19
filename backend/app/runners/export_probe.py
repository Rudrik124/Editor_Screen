import json
import subprocess
from fractions import Fraction
from pathlib import Path

from app.core.config import settings


def verify_export(path: Path, width: int, height: int, fps: int) -> None:
    """Fail closed if the finalized MP4 disagrees with the render request."""
    try:
        result = subprocess.run(
            [
                settings.get_ffprobe_path(), "-v", "error", "-select_streams", "v:0",
                "-show_entries",
                "format=format_name:stream=width,height,avg_frame_rate,codec_name,pix_fmt",
                "-of", "json", str(path),
            ],
            stdin=subprocess.DEVNULL, capture_output=True, check=True, timeout=30,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("Export verification requires ffprobe. Set FFPROBE_PATH or install ffprobe on PATH.") from exc
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeError("ffprobe could not verify the rendered video.") from exc

    try:
        metadata = json.loads(result.stdout)
        formats = metadata["format"]["format_name"].split(",")
        video = metadata["streams"][0]
        actual = (video["width"], video["height"], Fraction(video["avg_frame_rate"]),
                  video["codec_name"], video["pix_fmt"])
    except (KeyError, IndexError, AttributeError, TypeError, ValueError, ZeroDivisionError) as exc:
        raise RuntimeError("ffprobe returned incomplete or invalid export metadata.") from exc

    if "mp4" not in formats:
        raise RuntimeError("The rendered file is not an MP4.")
    if actual != (width, height, fps, "h264", "yuv420p"):
        actual_width, actual_height, actual_fps, codec, pixel_format = actual
        raise RuntimeError(
            f"Export settings mismatch: expected {width}x{height} at {fps} FPS (h264/yuv420p), "
            f"got {actual_width}x{actual_height} at {actual_fps} FPS ({codec}/{pixel_format})."
        )
