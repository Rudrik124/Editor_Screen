import ipaddress
import re
import urllib.parse
from pathlib import Path
from typing import Optional
from fastapi import HTTPException, status

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".mp3", ".wav", ".aac", ".png", ".jpg", ".jpeg"}

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal or special character injection."""
    # Strip leading directory traversal elements
    filename = re.sub(r"^(\.\.[/\\])+", "", filename)
    # Keep only alphanumeric, dash, underscore, dot
    clean = re.sub(r"[^\w\.-]", "_", filename)
    return clean or "asset"


def resolve_safe_path(base_dir: Path, relative_path: str) -> Path:
    """
    Safely resolve a path within base_dir.
    Raises HTTPException 400 if path attempts traversal outside base_dir.
    """
    if "\x00" in relative_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid null byte in path"
        )
    
    clean_rel = relative_path.lstrip("/\\")
    target = (base_dir / clean_rel).resolve()
    base_resolved = base_dir.resolve()

    try:
        if not target.is_relative_to(base_resolved):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: path traversal detected"
            )
    except AttributeError:
        # Fallback for Python < 3.9 if any
        if not str(target).startswith(str(base_resolved)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: path traversal detected"
            )
    return target

def is_safe_remote_url(url: str) -> bool:
    """
    Validates URL to block Server-Side Request Forgery (SSRF).
    Blocks private IP ranges, loopbacks, metadata services (AWS/GCP), and unsafe schemes.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False
        
        hostname_lower = hostname.lower()
        if hostname_lower in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"):
            return False

        # Try to parse as IP address to check private/loopback/link-local
        try:
            ip = ipaddress.ip_address(hostname_lower)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        except ValueError:
            # Domain name; check for common internal patterns
            if hostname_lower.endswith((".local", ".internal", ".lan", ".localdomain")):
                return False

        return True
    except Exception:
        return False

def validate_safe_url(url: str) -> str:
    """Raises HTTPException if URL is unsafe for SSRF."""
    if not is_safe_remote_url(url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Remote URL rejected: SSRF protection violation or invalid scheme"
        )
    return url

def validate_file_extension(filename: str) -> str:
    """Validates that file extension is an allowed media type."""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension: {ext}. Allowed: {sorted(ALLOWED_EXTENSIONS)}"
        )
    return ext
