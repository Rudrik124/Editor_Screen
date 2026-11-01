import asyncio
from app.api.v1.captions import transcribe_audio, TranscribeRequest

def test_transcribe_captions_endpoint():
    data = asyncio.run(
        transcribe_audio(TranscribeRequest(mediaUrl="https://example.com/audio.mp3", language="en"))
    )
    assert data.language == "en"
    assert len(data.segments) > 0
    assert len(data.segments[0].words) > 0
    assert "-->" in data.srt
    assert "1" in data.srt
