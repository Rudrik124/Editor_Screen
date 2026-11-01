import { API_BASE } from "./backendApi";

export interface TranscribeWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscribeSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  words: TranscribeWord[];
}

export interface TranscribeResponse {
  language: string;
  duration: number;
  segments: TranscribeSegment[];
  srt: string;
}

export async function transcribeMedia(mediaUrl: string, language = "en"): Promise<TranscribeResponse> {
  const res = await fetch(`${API_BASE}/captions/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaUrl, language }),
  });
  if (!res.ok) {
    throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}
