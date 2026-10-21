import pytest
from pathlib import Path
from fastapi import HTTPException
from app.core.security import (
    resolve_safe_path,
    is_safe_remote_url,
    sanitize_filename,
    validate_file_extension
)

def test_resolve_safe_path_valid(tmp_path: Path):
    safe_sub = tmp_path / "valid_file.mp4"
    safe_sub.write_text("dummy")
    resolved = resolve_safe_path(tmp_path, "valid_file.mp4")
    assert resolved == safe_sub.resolve()

def test_resolve_safe_path_blocks_traversal(tmp_path: Path):
    with pytest.raises(HTTPException) as exc_info:
        resolve_safe_path(tmp_path, "../../windows/system32/cmd.exe")
    assert exc_info.value.status_code == 403

def test_resolve_safe_path_blocks_null_byte(tmp_path: Path):
    with pytest.raises(HTTPException) as exc_info:
        resolve_safe_path(tmp_path, "video.mp4\x00.exe")
    assert exc_info.value.status_code == 400

def test_ssrf_blocks_private_ips():
    assert not is_safe_remote_url("http://127.0.0.1/secret")
    assert not is_safe_remote_url("http://localhost:8000")
    assert not is_safe_remote_url("http://169.254.169.254/latest/meta-data")
    assert not is_safe_remote_url("http://192.168.1.1/admin")
    assert not is_safe_remote_url("http://10.0.0.5/api")
    assert not is_safe_remote_url("ftp://example.com/video.mp4")
    assert not is_safe_remote_url("file:///etc/passwd")

def test_ssrf_allows_public_urls():
    assert is_safe_remote_url("https://example.com/sample.mp4")
    assert is_safe_remote_url("https://vriqwtzyxdnlpagexqay.supabase.co/storage/v1/object/public/video.mp4")

def test_sanitize_filename():
    assert sanitize_filename("../../../malicious name.mp4") == "malicious_name.mp4"
    assert sanitize_filename("clip;rm -rf /;.mp4") == "clip_rm_-rf___.mp4"

def test_validate_file_extension():
    assert validate_file_extension("test.mp4") == ".mp4"
    assert validate_file_extension("audio.wav") == ".wav"
    with pytest.raises(HTTPException):
        validate_file_extension("payload.exe")
