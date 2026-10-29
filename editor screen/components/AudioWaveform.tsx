import { useEffect, useRef, useState } from "react";
import { loadWaveformPeaks } from "../renderer/audio.waveform";

type WaveformState =
  | { status: "loading" }
  | { status: "ready"; peaks: Float32Array }
  | { status: "error"; message: string };

export function AudioWaveform({
  url,
  name,
}: {
  url?: string;
  name: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<WaveformState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    if (!url) {
      setWaveform({
        status: "error",
        message: "Audio source unavailable",
      });
      return () => {
        active = false;
      };
    }

    setWaveform({ status: "loading" });
    loadWaveformPeaks(url).then(
      (peaks) => {
        if (active) setWaveform({ status: "ready", peaks });
      },
      (error: unknown) => {
        if (!active) return;
        setWaveform({
          status: "error",
          message:
            error instanceof Error ? error.message : "Unable to decode waveform.",
        });
      }
    );

    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    if (waveform.status !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;

      context.scale(ratio, ratio);
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.fillStyle = "rgba(147, 197, 253, 0.85)";
      const centerY = bounds.height / 2;
      const bucketWidth = bounds.width / waveform.peaks.length;
      const barWidth = Math.max(1, bucketWidth * 0.62);
      waveform.peaks.forEach((peak, index) => {
        const height = Math.max(1, peak * bounds.height * 0.88);
        const x = index * bucketWidth + (bucketWidth - barWidth) / 2;
        context.fillRect(x, centerY - height / 2, barWidth, height);
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [waveform]);

  const statusText =
    waveform.status === "loading"
      ? "Loading waveform"
      : waveform.status === "error"
        ? "Waveform unavailable"
        : "";
  const accessibleName =
    waveform.status === "ready"
      ? `Waveform for ${name}`
      : `${statusText} for ${name}`;

  return (
    <div
      className={`audio-waveform ${waveform.status}`}
      role="img"
      aria-label={accessibleName}
      aria-busy={waveform.status === "loading"}
      title={waveform.status === "error" ? waveform.message : accessibleName}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      {statusText && <span className="audio-waveform-status">{statusText}</span>}
    </div>
  );
}
