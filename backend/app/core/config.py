from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
import imageio_ffmpeg

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Veytrix Video Editor Backend"
    
    # Storage Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    UPLOAD_DIR: Path = STORAGE_DIR / "uploads"
    EXPORT_DIR: Path = STORAGE_DIR / "exports"

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Multi-User Concurrency & Quotas
    MAX_CONCURRENT_RENDERS_PER_USER: int = 2
    GLOBAL_MAX_CONCURRENT_RENDERS: int = 4
    MAX_RENDER_TIMEOUT_SECONDS: int = 600  # 10 minutes max per export
    MAX_UPLOAD_SIZE_BYTES: int = 500 * 1024 * 1024  # 500 MB

    # FFmpeg Binary Locator
    FFMPEG_BINARY: str = ""

    def get_ffmpeg_path(self) -> str:
        """Returns verified FFmpeg executable path."""
        if self.FFMPEG_BINARY and Path(self.FFMPEG_BINARY).exists():
            return self.FFMPEG_BINARY
        try:
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return "ffmpeg"

    def setup_directories(self) -> None:
        """Ensure all storage folders exist."""
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.EXPORT_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.setup_directories()
