import asyncio
import logging
import subprocess
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
            logger.warning(
                "Async subprocesses are unavailable on this event loop; "
                "using the Windows-compatible synchronous FFmpeg fallback."
            )
            try:
                result = await asyncio.to_thread(
                    subprocess.run,
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=timeout_seconds,
                    check=False,
                )
            except subprocess.TimeoutExpired as error:
                raise TimeoutError(
                    f"Render exceeded maximum timeout of {timeout_seconds}s"
                ) from error

            if result.returncode != 0:
                error_output = result.stderr.decode("utf-8", errors="replace")[-2000:].strip()
                if not error_output:
                    error_output = (
                        f"FFmpeg exited with code {result.returncode} "
                        "without diagnostic output."
                    )
                raise RuntimeError(f"FFmpeg render process failed: {error_output}")

            if progress_callback:
                await progress_callback(100, None, None)
            return True

        async def read_stdout():
            current_frame = 0
            current_fps = 0.0
            
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                decoded = line.decode("utf-8", errors="replace").strip()
                if not decoded:
                    continue

                # Progress output format from -progress pipe:1:
                # frame=120
                # fps=30.0
                # out_time_us=4000000
                # progress=continue/end
                if decoded.startswith("frame="):
                    try:
                        current_frame = int(decoded.split("=")[1].strip())
                    except ValueError:
                        pass
                elif decoded.startswith("fps="):
                    try:
                        current_fps = float(decoded.split("=")[1].strip())
                    except ValueError:
                        pass
                elif decoded.startswith("out_time_us="):
                    try:
                        time_us = int(decoded.split("=")[1].strip())
                        pct = min(100, max(0, int((time_us / total_duration_us) * 100)))
                        if progress_callback:
                            await progress_callback(pct, current_frame, current_fps)
                    except ValueError:
                        pass
                elif decoded == "progress=end":
                    if progress_callback:
                        await progress_callback(100, current_frame, current_fps)

        async def read_stderr():
            chunks = []
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                chunks.append(line)
            return b"".join(chunks)

        try:
            _, _, stderr_bytes = await asyncio.wait_for(
                asyncio.gather(read_stdout(), process.wait(), read_stderr()),
                timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise TimeoutError(f"Render exceeded maximum timeout of {timeout_seconds}s")
        except Exception:
            process.kill()
            await process.wait()
            raise

        if process.returncode != 0:
            err_msg = stderr_bytes.decode("utf-8", errors="replace")[-2000:].strip()
            if not err_msg:
                err_msg = f"FFmpeg exited with code {process.returncode} without diagnostic output."
            logger.error(f"FFmpeg failed with code {process.returncode}: {err_msg}")
            raise RuntimeError(f"FFmpeg render process failed: {err_msg}")

        return True
