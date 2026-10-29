import { describe, expect, it } from "vitest";
import { computeWaveformPeaks } from "./audio.waveform";

describe("audio waveform utilities", () => {
  it("computes evenly spaced waveform peaks from an AudioBuffer-like input", () => {
    const length = 160;
    const data = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      data[i] = i < 80 ? 0.25 : 0.75;
    }

    const mockedBuffer = {
      length,
      numberOfChannels: 1,
      getChannelData: () => data,
    } as Pick<AudioBuffer, "numberOfChannels" | "length" | "getChannelData">;

    const peaks = computeWaveformPeaks(mockedBuffer, 8);

    expect(peaks.length).toBe(8);
    expect(peaks[0]).toBeGreaterThanOrEqual(0.25);
    expect(peaks[7]).toBeGreaterThanOrEqual(0.75);
    expect(peaks.some((peak) => peak > 0)).toBe(true);
  });

  it("returns a zeroed array for empty audio buffers", () => {
    const mockedBuffer = {
      length: 0,
      numberOfChannels: 0,
      getChannelData: () => new Float32Array(0),
    } as Pick<AudioBuffer, "numberOfChannels" | "length" | "getChannelData">;

    const peaks = computeWaveformPeaks(mockedBuffer, 16);

    expect(peaks.length).toBe(16);
    expect(peaks.every((peak) => peak === 0)).toBe(true);
  });
});
