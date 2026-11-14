from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field

# -------------------------------------------------------------
# 25 Tool Call Models for AI Assistant
# -------------------------------------------------------------

class DuplicateClipArgs(BaseModel):
    clipId: str = Field(..., description="ID of the clip to duplicate")

class SplitClipArgs(BaseModel):
    clipId: str = Field(..., description="ID of the clip to split")
    splitTime: float = Field(..., ge=0.0, description="Time in seconds where split occurs")
    newClipId: Optional[str] = Field(None, description="Optional ID for the new second clip")

class TrimClipArgs(BaseModel):
    clipId: str = Field(..., description="ID of the clip to trim")
    start: Optional[float] = Field(None, ge=0.0, description="New start time on timeline in seconds")
    end: Optional[float] = Field(None, gt=0.0, description="New end time on timeline in seconds")
    duration: Optional[float] = Field(None, gt=0.0, description="Target duration in seconds")
    edge: Optional[str] = Field(None, description="'left' or 'right'")
    newTime: Optional[float] = Field(None, ge=0.0, description="New time in seconds for the edge")
    inPoint: Optional[float] = Field(None, ge=0.0, description="Optional source media in-point")
    outPoint: Optional[float] = Field(None, gt=0.0, description="Optional source media out-point")

class AddTransitionArgs(BaseModel):
    clipId: str = Field(..., description="Target clip ID")
    type: str = Field(..., description="Transition type: cross_dissolve, fade_black, fade_white, dip_to_color, instant_cut, zoom_in, zoom_out, slide_left, slide_right, push_up")
    duration: float = Field(default=0.5, ge=0.1, le=5.0, description="Duration of transition in seconds")
    color: Optional[str] = Field(None, description="Hex color for dip_to_color (e.g. #000000)")

class RemoveTransitionArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to remove transition from")

class SetOverlapArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to move or layer")
    targetTrackId: str = Field(..., description="Target track ID (e.g. overlay, video)")
    targetStartTime: float = Field(..., ge=0.0, description="New start time in seconds")

class SetClipTransformArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to transform")
    scale: Optional[float] = Field(None, gt=0.0, le=10.0, description="Scale factor (1.0 = 100%)")
    opacity: Optional[float] = Field(None, ge=0.0, le=1.0, description="Opacity (0.0 to 1.0)")
    positionX: Optional[float] = Field(None, description="Horizontal position offset in px or %")
    positionY: Optional[float] = Field(None, description="Vertical position offset in px or %")
    rotation: Optional[float] = Field(None, description="Rotation angle in degrees")

class ReverseClipArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to reverse playback")

class ExtractAudioArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to extract audio from into separate audio track")

class AddKeyframeArgs(BaseModel):
    clipId: str = Field(..., description="Target clip ID")
    timeOffset: float = Field(..., ge=0.0, description="Time offset from clip start in seconds")
    property: str = Field(..., description="Property: opacity, scale, rotation, positionX, positionY, volume")
    value: float = Field(..., description="Keyframe value")
    interpolation: str = Field(default="linear", description="linear, easeIn, easeOut, easeInOut")

class RemoveKeyframeArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID")
    keyframeId: str = Field(..., description="Keyframe ID to remove")

class SetSpeedArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID")
    speed: float = Field(..., gt=0.1, le=10.0, description="Playback speed multiplier (e.g. 0.5, 1.0, 2.0)")

class SetAudioVolumeArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID")
    volume: float = Field(..., ge=0.0, le=5.0, description="Volume level (0.0 to 5.0, 1.0 = normal)")

class MuteClipArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID")
    muted: bool = Field(default=True, description="Mute state")

class MuteTrackArgs(BaseModel):
    trackId: str = Field(..., description="Track ID to mute")
    muted: bool = Field(default=True, description="Mute state")

class FreezeClipArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to freeze")
    freezeTime: float = Field(..., ge=0.0, description="Timeline timestamp to freeze at")
    duration: float = Field(default=3.0, gt=0.1, le=30.0, description="Freeze duration in seconds")

class SetCoverArgs(BaseModel):
    time: float = Field(..., ge=0.0, description="Timestamp for project poster/thumbnail frame")

class ReplaceClipArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to replace media for")
    assetId: str = Field(..., description="New asset ID")
    mediaUrl: str = Field(..., description="New media URL")
    name: Optional[str] = Field(None, description="Optional new display name")

class RenameClipArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to rename")
    name: str = Field(..., min_length=1, description="New name for clip")

class LockClipArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to lock or unlock")
    locked: bool = Field(default=True, description="Lock state")

class DeleteClipArgs(BaseModel):
    clipId: str = Field(..., description="Clip ID to delete")

class SetEffectsArgs(BaseModel):
    clipId: str = Field(..., description="Target clip ID")
    effects: List[Dict[str, Any]] = Field(default_factory=list, description="Array of effects, e.g. [{'type': 'blur', 'parameters': {'strength': 5}}]")

class SetFiltersArgs(BaseModel):
    clipId: str = Field(..., description="Target clip ID")
    filters: List[Dict[str, Any]] = Field(default_factory=list, description="Array of filters, e.g. [{'type': 'cinematic_lut', 'intensity': 1.0}]")

class AutoTranscribeCaptionsArgs(BaseModel):
    clipId: Optional[str] = Field(default=None, description="Target clip ID to transcribe")
    language: Optional[str] = Field(default="auto", description="Spoken language code")

class AddCaptionArgs(BaseModel):
    clipId: str = Field(..., description="Source clip ID to attach captions to")
    captions: List[Dict[str, Any]] = Field(..., description="List of caption items [{text, startTime, endTime}]")

class SetRatioArgs(BaseModel):
    aspectRatio: str = Field(..., description="Aspect ratio: 16:9, 9:16, 1:1, 4:5, 21:9")

class AddClipArgs(BaseModel):
    trackId: str = Field(..., description="Track ID (video, audio, text, music)")
    clip: Dict[str, Any] = Field(..., description="Clip model data")

class UndoRedoArgs(BaseModel):
    action: str = Field(..., description="'UNDO' or 'REDO'")

# Mapping tool names to argument models
TOOL_ARG_MODELS: Dict[str, Any] = {
    "duplicate_clip": DuplicateClipArgs,
    "split_clip": SplitClipArgs,
    "trim_clip": TrimClipArgs,
    "add_transition": AddTransitionArgs,
    "remove_transition": RemoveTransitionArgs,
    "set_overlap": SetOverlapArgs,
    "set_clip_transform": SetClipTransformArgs,
    "reverse_clip": ReverseClipArgs,
    "extract_audio": ExtractAudioArgs,
    "add_keyframe": AddKeyframeArgs,
    "remove_keyframe": RemoveKeyframeArgs,
    "set_speed": SetSpeedArgs,
    "set_audio_volume": SetAudioVolumeArgs,
    "mute_clip": MuteClipArgs,
    "mute_track": MuteTrackArgs,
    "freeze_clip": FreezeClipArgs,
    "set_cover": SetCoverArgs,
    "replace_clip": ReplaceClipArgs,
    "rename_clip": RenameClipArgs,
    "lock_clip": LockClipArgs,
    "delete_clip": DeleteClipArgs,
    "set_effects": SetEffectsArgs,
    "set_filters": SetFiltersArgs,
    "auto_transcribe_captions": AutoTranscribeCaptionsArgs,
    "add_caption": AddCaptionArgs,
    "set_ratio": SetRatioArgs,
    "add_clip": AddClipArgs,
    "undo_redo": UndoRedoArgs,
}

# -------------------------------------------------------------
# Request & Response Contracts
# -------------------------------------------------------------

class ToolCallRequestItem(BaseModel):
    name: str
    args: Dict[str, Any] = Field(default_factory=dict)
    id: Optional[str] = None

class ChatMessageSchema(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text")

class AIAssistantPromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Natural language editing instruction")
    timelineState: Dict[str, Any] = Field(..., description="Full current editor state manifest")
    selectedClipId: Optional[str] = None
    currentTime: Optional[float] = 0.0
    conversationHistory: List[ChatMessageSchema] = Field(default_factory=list, description="Prior conversational context")
    projectId: Optional[str] = None
    userId: Optional[str] = None

class EditorCommandSchema(BaseModel):
    id: str
    type: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: float

class AIAssistantResponse(BaseModel):
    success: bool
    message: str
    responseText: str = Field(default="", description="Conversational explanation or assistant reply")
    planSteps: List[str] = Field(default_factory=list, description="Step-by-step breakdown of actions")
    requiresConfirmation: bool = Field(default=False, description="Whether plan requires explicit user confirmation")
    tool_calls: List[ToolCallRequestItem] = Field(default_factory=list)
    commands: List[EditorCommandSchema] = Field(default_factory=list)
    validation_errors: List[str] = Field(default_factory=list)
    remaining_credits: int = 50
    model_used: str = "gemini-3.1-flash-lite"
