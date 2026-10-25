from pathlib import Path
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
import imageio_ffmpeg

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            Path(__file__).resolve().parent.parent.parent / ".env",
            Path(__file__).resolve().parent.parent.parent.parent / ".env",
            ".env"
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Application Settings
    APP_NAME: str = "Backend"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEVELOPER_MODE: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Veytrix Video Editor Backend"
    
    # Storage Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    UPLOAD_DIR: Path = STORAGE_DIR / "uploads"
    EXPORT_DIR: Path = STORAGE_DIR / "exports"

    # CORS Configuration
    ALLOWED_ORIGINS: Union[List[str], str] = "http://localhost:3000,http://localhost:5173,http://localhost:8000"
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    def get_cors_origins(self) -> List[str]:
        origins = set(self.CORS_ORIGINS)
        if isinstance(self.ALLOWED_ORIGINS, str):
            for o in self.ALLOWED_ORIGINS.split(","):
                if o.strip():
                    origins.add(o.strip())
        elif isinstance(self.ALLOWED_ORIGINS, list):
            origins.update(self.ALLOWED_ORIGINS)
        return list(origins)

    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Database & Auth
    DATABASE_URL: str = ""
    JWT_SECRET: str = ""

    # Storage
    STORAGE_BUCKET: str = "veytrix-assets"

    @property
    def effective_supabase_key(self) -> str:
        return self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_KEY or self.SUPABASE_ANON_KEY

    @property
    def effective_jwt_secret(self) -> str:
        return self.JWT_SECRET or self.SUPABASE_JWT_SECRET

    # Multi-User Concurrency & Quotas
    MAX_CONCURRENT_RENDERS_PER_USER: int = 2
    GLOBAL_MAX_CONCURRENT_RENDERS: int = 4
    MAX_RENDER_TIMEOUT_SECONDS: int = 600  # 10 minutes max per export
    MAX_UPLOAD_SIZE_BYTES: int = 500 * 1024 * 1024  # 500 MB

    # FFmpeg Binary Locator
    FFMPEG_PATH: str = ""
    FFMPEG_BINARY: str = ""

    def get_ffmpeg_path(self) -> str:
        """Returns verified FFmpeg executable path."""
        for candidate in (self.FFMPEG_PATH, self.FFMPEG_BINARY):
            if candidate and Path(candidate).exists():
                return candidate
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
