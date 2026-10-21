export type FrameCallback = (time: number) => void;

export class FrameScheduler {
  private rafId: number | null = null;
  private isRunning = false;
  private callbacks: Set<FrameCallback> = new Set();

  public subscribe(cb: FrameCallback): () => void {
    this.callbacks.add(cb);
    return () => {
      this.callbacks.delete(cb);
    };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;
      this.callbacks.forEach((cb) => {
        try {
          cb(timestamp);
        } catch (err) {
          console.error("FrameScheduler callback error:", err);
        }
      });
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public requestSingleFrame(): void {
    requestAnimationFrame((timestamp) => {
      this.callbacks.forEach((cb) => cb(timestamp));
    });
  }
}

export const frameScheduler = new FrameScheduler();
