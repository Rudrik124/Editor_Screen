const WAVEFORM_SAMPLE_COUNT = 256;
const MAX_CACHED_WAVEFORMS = 100;
const waveformCache = new Map<string, Promise<Float32Array>>();

export function computeWaveformPeaks(
  audioBuffer: Pick<AudioBuffer, "numberOfChannels" | "length" | "getChannelData">,
  sampleCount = WAVEFORM_SAMPLE_COUNT
): Float32Array {
  const count = Math.max(1, Math.floor(sampleCount));
  const peaks = new Float32Array(count);
  if (audioBuffer.length === 0 || audioBuffer.numberOfChannels === 0) return peaks;

  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) =>
    audioBuffer.getChannelData(index)
  );
  const samplesPerBucket = audioBuffer.length / count;

  for (let bucket = 0; bucket < count; bucket += 1) {
    const start = Math.floor(bucket * samplesPerBucket);
    const end = Math.max(start + 1, Math.floor((bucket + 1) * samplesPerBucket));
    let peak = 0;
    for (const channel of channelData) {
      for (let sample = start; sample < Math.min(end, channel.length); sample += 1) {
        peak = Math.max(peak, Math.abs(channel[sample]));
      }
    }
    peaks[bucket] = peak;
  }

  return peaks;
}

export function loadWaveformPeaks(url: string): Promise<Float32Array> {
  const cached = waveformCache.get(url);
  if (cached) return cached;

  const decoding = decodeWaveform(url);
  waveformCache.set(url, decoding);
  if (waveformCache.size > MAX_CACHED_WAVEFORMS) {
    const oldestUrl = waveformCache.keys().next().value as string | undefined;
    if (oldestUrl) waveformCache.delete(oldestUrl);
  }

  void decoding.catch(() => {
    if (waveformCache.get(url) === decoding) waveformCache.delete(url);
  });
  return decoding;
}

async function decodeWaveform(url: string): Promise<Float32Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load audio waveform (${response.status}).`);
  }

  const data = await response.arrayBuffer();
  const OfflineContext = window.OfflineAudioContext;
  if (!OfflineContext) {
    throw new Error("Waveform decoding is not supported by this browser.");
  }

  const context = new OfflineContext(1, 1, 44100);
  const audioBuffer = await context.decodeAudioData(data);
  return computeWaveformPeaks(audioBuffer);
}
