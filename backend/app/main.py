import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.health import router as health_router
from app.api.v1.assets import router as assets_router
from app.api.v1.timeline import router as timeline_router
from app.api.v1.render import router as render_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("veytrix.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Veytrix Video Editor Backend...")
    settings.setup_directories()
    ffmpeg_path = settings.get_ffmpeg_path()
    logger.info(f"Verified FFmpeg executable: {ffmpeg_path}")
    yield
    logger.info("Shutting down Veytrix Backend.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware for modern web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for local asset playback
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")

# Mount API v1 Routers
app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(assets_router, prefix=settings.API_V1_STR)
app.include_router(timeline_router, prefix=settings.API_V1_STR)
app.include_router(render_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health"
    }
