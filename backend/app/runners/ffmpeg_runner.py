import asyncio
import logging
from typing import Callable, Optional, Awaitable

logger = logging.getLogger("veytrix.ffmpeg_runner")

class FFmpegRunner:
    """
    Executes FFmpeg subprocesses securely and parses line-by-line progress
    from stdout pipe in real-time.
    """

    @staticmethod
    async def run(
        cmd: list[str],
        total_duration_seconds: float,
        progress_callback: Optional[Callable[[int, Optional[int], Optional[float]], Awaitable[None]]] = None,
        timeout_seconds: float = 600.0
    ) -> bool:
        """
        Executes FFmpeg subprocess without shell=True.
        Calculates and pushes live progress percentage (0-100%).
        """
        logger.info(f"Launching FFmpeg: {' '.join(cmd[:4])} ... {cmd[-1]}")
        total_duration_us = max(1.0, total_duration_seconds * 1_000_000)

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
        except NotImplementedError:
            if not hasattr(asyncio, "ProactorEventLoop"):
                raise
            # Uvicorn's Windows reload loop can use a selector, which cannot spawn subprocesses.
            caller_loop = asyncio.get_running_loop()

            async def relay(pct, frame, fps):
                update = asyncio.run_coroutine_threadsafe(progress_callback(pct, frame, fps), caller_loop)
                await asyncio.wrap_future(update)

            def run_on_proactor():
                loop = asyncio.ProactorEventLoop()
                try:
                    return loop.run_until_complete(FFmpegRunner.run(
                        cmd, total_duration_seconds, relay if progress_callback else None, timeout_seconds
                    ))
                finally:
                    loop.close()

            return await asyncio.to_thread(run_on_proactor)

        stderr_chunks: list[bytes] = []

        async def read_stdout():
            buffer = ""
            current_frame = 0
            current_fps = 0.0
            last_report = None
            time_us = 0
            while raw_line := await process.stdout.readline():
                key, _, value = raw_line.decode("utf-8", errors="replace").strip().partition("=")
                try:
                    if key == "frame":
                        current_frame = int(value)
                    elif key == "fps":
                        current_fps = float(value)
                    elif key in ("out_time_us", "out_time_ms"):
                        # FFmpeg's older out_time_ms field is also expressed in microseconds.
                        time_us = int(value)
                except ValueError:
                    continue
                if key == "progress" and progress_callback:
                    pct = 100 if value == "end" else min(99, max(0, int(100 * time_us / total_duration_us)))
                    report = (pct, current_frame, current_fps)
                    if report != last_report:
                        await progress_callback(*report)
                        last_report = report

        async def read_stderr():
            while True:
                chunk = await process.stderr.read(4096)
                if not chunk:
                    break
                stderr_chunks.append(chunk)
                if len(stderr_chunks) > 50:
                    del stderr_chunks[:-20]

        try:
            await asyncio.wait_for(
                asyncio.gather(read_stdout(), read_stderr(), process.wait()),
                timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            if process.returncode is None:
                process.kill()
            await process.wait()
            raise TimeoutError(f"Render exceeded maximum timeout of {timeout_seconds}s")
        except (Exception, asyncio.CancelledError):
            if process.returncode is None:
                process.kill()
            await process.wait()
            raise

        stderr_bytes = b"".join(stderr_chunks)
        if process.returncode != 0:
            err_msg = stderr_bytes.decode("utf-8", errors="replace")[-2000:].strip()
            if not err_msg:
                err_msg = f"FFmpeg exited with code {process.returncode} without diagnostic output."
            logger.error(f"FFmpeg failed with code {process.returncode}: {err_msg}")
            raise RuntimeError(f"FFmpeg render process failed: {err_msg}")

        return True
