import asyncio
import logging
import re
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger("veytrix.probe_runner")

class ProbeRunner:
    """Probes media files using FFmpeg directly to retrieve stream metadata."""

    @staticmethod
    async def probe(file_path: str) -> Dict[str, Any]:
        """Runs ffmpeg -i on given media file and parses streams/duration."""
        ffmpeg_bin = settings.get_ffmpeg_path()
        cmd = [ffmpeg_bin, "-i", file_path]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            _, stderr = await process.communicate()
            output = stderr.decode("utf-8", errors="replace")

            # 1. Parse Duration
            duration = 0.0
            dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", output)
            if dur_match:
                hours, mins, secs = dur_match.groups()
                duration = int(hours) * 3600 + int(mins) * 60 + float(secs)

            # 2. Parse Video Stream (width, height, fps)
            streams = []
            v_match = re.search(r"Stream #\d+:\d+.*Video:.*?,\s*(\d+)x(\d+)", output)
            if v_match:
                w, h = int(v_match.group(1)), int(v_match.group(2))
                fps = 30.0
                fps_match = re.search(r"(\d+(?:\.\d+)?)\s*fps", output)
                if fps_match:
                    fps = float(fps_match.group(1))

                streams.append({
                    "codec_type": "video",
                    "width": w,
                    "height": h,
                    "fps": fps
                })

            # 3. Parse Audio Stream
            if "Audio:" in output:
                streams.append({"codec_type": "audio"})

            return {
                "format": {"duration": str(round(duration, 3))},
                "streams": streams if streams else [{"codec_type": "video", "width": 1920, "height": 1080}]
            }
        except Exception as e:
            logger.warning(f"FFmpeg probing failed: {e}. Falling back to default metadata.")
            return {
                "format": {"duration": "0.0"},
                "streams": [{"codec_type": "video", "width": 1920, "height": 1080}]
            }

