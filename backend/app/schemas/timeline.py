from typing import List, Optional, Literal, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, model_validator

class TransitionSchema(BaseModel):
    type: str = "fade"  # fade, wipeleft, wiperight, dissolve, slideup, slidedown, circlecrop
    duration: float = Field(default=0.5, ge=0.0, le=5.0)
    color: Optional[str] = None

class FilterSchema(BaseModel):
    type: str  # brightness, contrast, saturation, vignette, grayscale, sepia, invert
    intensity: float = 1.0

class EffectSchema(BaseModel):
    type: str  # blur, zoom, glitch, shake
    parameters: Dict[str, Any] = Field(default_factory=dict)

class KeyframeSchema(BaseModel):
    timeOffset: float = Field(ge=0.0)
    property: str  # opacity, scale, rotation, positionX, positionY, volume
    value: Any
    interpolation: Literal["linear", "easeIn", "easeOut", "easeInOut"] = "linear"

class ClipSchema(BaseModel):
    id: str
    trackId: str
    name: str = "Untitled"
    type: Literal["video", "audio", "text", "music", "image"] = "video"
    mediaType: Optional[str] = None
    start: float = Field(default=0.0, ge=0.0)
    duration: float = Field(gt=0.0)
    inPoint: float = Field(default=0.0, ge=0.0)
    outPoint: Optional[float] = None
    mediaUrl: Optional[str] = None
    assetId: Optional[str] = None
    color: Optional[str] = None
    
    # Speed & Transform Controls
    speed: float = Field(default=1.0, gt=0.0, le=100.0)
    reverse: bool = False
    isFrozen: bool = False
    freezeTime: Optional[float] = None
    volume: float = Field(default=1.0, ge=0.0, le=5.0)
    muted: bool = False
    
    # Layering & Transforms
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    rotation: float = 0.0
    scale: float = Field(default=1.0, gt=0.0)
    positionX: float = 0.0
    positionY: float = 0.0
    
    # Advanced Plugins
    transition: Optional[TransitionSchema] = None
    filters: List[FilterSchema] = Field(default_factory=list)
    effects: List[EffectSchema] = Field(default_factory=list)
    keyframes: List[KeyframeSchema] = Field(default_factory=list)
    textData: Optional[Dict[str, Any]] = None

class TrackSchema(BaseModel):
    id: str
    label: str
    type: Literal["video", "audio", "text", "music", "image"]
    clipIds: List[str] = Field(default_factory=list)
    orderIndex: int = 0
    muted: bool = False
    hidden: bool = False
    locked: bool = False

class WatermarkExportSettings(BaseModel):
    enabled: bool
    source: Literal["official", "custom"]
    assetId: Optional[UUID] = None
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(ge=0.03, le=0.6)
    opacity: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def require_custom_asset(self):
        if self.enabled and self.source == "custom" and self.assetId is None:
            raise ValueError("Select a custom watermark asset")
        return self


ExportResolutionPreset = Literal["720p", "1080p", "4k"]
ExportAspectRatio = Literal["16:9", "9:16", "1:1", "4:5", "21:9"]

EXPORT_DIMENSIONS: dict[ExportResolutionPreset, dict[ExportAspectRatio, tuple[int, int]]] = {
    "720p": {
        "16:9": (1280, 720), "9:16": (720, 1280), "1:1": (720, 720),
        "4:5": (576, 720), "21:9": (1680, 720),
    },
    "1080p": {
        "16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080),
        "4:5": (864, 1080), "21:9": (2520, 1080),
    },
    "4k": {
        "16:9": (3840, 2160), "9:16": (2160, 3840), "1:1": (2160, 2160),
        "4:5": (1728, 2160), "21:9": (3840, 1646),
    },
}


class TimelineExportRequest(BaseModel):
    projectId: Optional[str] = None
    tracks: List[TrackSchema]
    clips: List[ClipSchema]
    fps: int = Field(default=30, ge=1, le=120)
    width: int = Field(default=1920, ge=320, le=3840)
    height: int = Field(default=1080, ge=240, le=3840)
    resolutionPreset: Optional[ExportResolutionPreset] = None
    aspectRatio: Optional[ExportAspectRatio] = None
    quality: Literal["draft", "standard", "high"] = "standard"
    coverUrl: Optional[str] = None
    watermark: Optional[WatermarkExportSettings] = None

    @model_validator(mode="after")
    def resolve_export_dimensions(self):
        if self.resolutionPreset is None and self.aspectRatio is None:
            if self.height > 2160:
                raise ValueError("height must be at most 2160 without a resolution preset")
            return self

        if self.resolutionPreset is None or self.aspectRatio is None:
            raise ValueError("resolutionPreset and aspectRatio must be provided together")

        width, height = EXPORT_DIMENSIONS[self.resolutionPreset][self.aspectRatio]
        if ("width" in self.model_fields_set and self.width != width) or (
            "height" in self.model_fields_set and self.height != height
        ):
            raise ValueError(f"Explicit dimensions must match the selected resolution ({width}x{height})")

        self.width = width
        self.height = height
        return self
