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


class TimelineExportRequest(BaseModel):
    projectId: Optional[str] = None
    tracks: List[TrackSchema]
    clips: List[ClipSchema]
    fps: int = Field(default=30, ge=1, le=120)
    width: int = Field(default=1920, ge=320, le=3840)
    height: int = Field(default=1080, ge=240, le=2160)
    quality: Literal["draft", "standard", "high"] = "standard"
    coverUrl: Optional[str] = None
    watermark: Optional[WatermarkExportSettings] = None
