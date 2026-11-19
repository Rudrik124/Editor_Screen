import asyncio
import sys

import pytest

from app.core.config import settings
from app.runners.ffmpeg_runner import FFmpegRunner


@pytest.mark.skipif(sys.platform != "win32", reason="Windows selector-loop fallback")
def test_windows_selector_loop_streams_progress_before_completion():
    async def run():
        updates = []

        async def on_progress(percent, frame, fps):
            updates.append((percent, frame))

        await FFmpegRunner.run(
            [settings.get_ffmpeg_path(), "-nostdin", "-loglevel", "error",
             "-stats_period", "0.1", "-progress", "pipe:1", "-re", "-f", "lavfi",
             "-i", "testsrc2=size=320x240:rate=30", "-t", "1.5", "-f", "null", "-"],
            total_duration_seconds=1.5,
            progress_callback=on_progress,
            timeout_seconds=15,
        )
        assert any(0 < percent < 100 and frame > 0 for percent, frame in updates)
        assert updates[-1][0] == 100

    loop = asyncio.SelectorEventLoop()
    try:
        loop.run_until_complete(run())
    finally:
        loop.close()
