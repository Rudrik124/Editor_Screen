import re
from typing import List, Tuple, Optional

PROFESSIONAL_TERMS = [
    'j-cut', 'l-cut', 'lufs', 'dbfs', 'smpte', 'timecode', 'aaf', 'edl', 'xml',
    'prores', 'dnxhd', 'dnxhr', 'arriraw', 'redcode', 'dci-p3', 'aces', 'lut',
    'cst', 'color space', 'normalization', 'checkerboard', 'picture lock', 'conform',
    'turnover', 'handles', 'room tone', 'adr', 'stem', 'dme', 'offline', 'online',
    'circle take', 'dit', 'timecode burn', 'multicam', 'sync point', 'frame rate'
]

INTERMEDIATE_TERMS = [
    'transition', 'keyframe', 'opacity', 'waveform', 'proxy', 'b-roll', 'a-roll',
    'color grade', 'color correct', 'export settings', 'rough cut', 'assembly',
    'audio ducking', 'gain', 'normalize', 'dissolve', 'match cut', 'jump cut',
    'lower third', 'motion graphics', 'tracking', 'mask', 'blend mode', 'volume curve'
]

BEGINNER_PATTERNS = [
    re.compile(r"make it (look|seem|feel)", re.I),
    re.compile(r"how do i", re.I),
    re.compile(r"can you (make|add|put|change)", re.I),
    re.compile(r"what is", re.I),
    re.compile(r"it looks (weird|bad|wrong|blurry)", re.I),
    re.compile(r"i want to", re.I),
    re.compile(r"cut out the (boring|bad) part", re.I)
]

def detect_user_tier(prompt_history: List[str]) -> str:
    """
    Detects user tier: 'beginner', 'intermediate', or 'professional'
    based on vocabulary and phrasing patterns.
    """
    recent_text = " ".join(prompt_history[-10:]).lower()
    
    pro_score = sum(1 for term in PROFESSIONAL_TERMS if term in recent_text)
    int_score = sum(1 for term in INTERMEDIATE_TERMS if term in recent_text)
    beg_score = sum(1 for p in BEGINNER_PATTERNS if p.search(recent_text))

    if pro_score >= 1 or (pro_score >= 1 and int_score >= 1):
        return "professional"
    if int_score >= 2 or (int_score >= 1 and beg_score == 0):
        return "intermediate"
    return "beginner"

def smpte_timecode_to_seconds(tc: str, fps: float = 30.0) -> Optional[float]:
    """
    Converts SMPTE timecode HH:MM:SS:FF or HH:MM:SS.mmm to seconds.
    """
    tc = tc.strip()
    match = re.match(r"^(\d{1,2}):(\d{2}):(\d{2})[:;](\d{2})$", tc)
    if match:
        h, m, s, f = match.groups()
        return int(h) * 3600.0 + int(m) * 60.0 + int(s) + (int(f) / fps)
    
    match_ms = re.match(r"^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$", tc)
    if match_ms:
        h, m, s, ms = match_ms.groups()
        fraction = float(f"0.{ms}") if ms else 0.0
        return int(h) * 3600.0 + int(m) * 60.0 + int(s) + fraction
    return None

def db_to_linear_gain(db_val: float) -> float:
    """
    Converts decibels (dB) to linear gain.
    e.g. 0 dB = 1.0, -6 dB ≈ 0.501, -18 dB ≈ 0.126, -42 dB ≈ 0.0079
    """
    return round(10.0 ** (db_val / 20.0), 4)

def parse_db_expression(text: str) -> Optional[float]:
    """
    Extracts decibel value like '-18dB', '-6 db' from prompt.
    """
    match = re.search(r"(-?\d+(?:\.\d+)?)\s*db(?:fs)?\b", text, re.I)
    if match:
        db = float(match.group(1))
        return db_to_linear_gain(db)
    return None

def parse_frames_expression(text: str, fps: float = 30.0) -> Optional[float]:
    """
    Extracts frame count like '10 frames', '8 frames' and converts to seconds at project FPS.
    """
    match = re.search(r"(\d+)\s*frames?\b", text, re.I)
    if match:
        frames = int(match.group(1))
        return round(frames / fps, 4)
    return None
