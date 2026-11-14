from typing import List, Dict, Any

GEMINI_TOOLS_SCHEMA = [
    {
        "function_declarations": [
            {
                "name": "duplicate_clip",
                "description": "Duplicates an existing timeline clip, placing a clone right after it.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "ID of the clip to duplicate"}
                    },
                    "required": ["clipId"]
                }
            },
            {
                "name": "split_clip",
                "description": "Splits a timeline clip into two distinct clips at the given split time.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "ID of the clip to split"},
                        "splitTime": {"type": "NUMBER", "description": "Timeline position in seconds where cut occurs"}
                    },
                    "required": ["clipId", "splitTime"]
                }
            },
            {
                "name": "trim_clip",
                "description": "Trims or adjusts boundaries or duration of a clip on the timeline.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "ID of the clip to trim"},
                        "start": {"type": "NUMBER", "description": "New timeline start time in seconds (optional, default 0)"},
                        "end": {"type": "NUMBER", "description": "New timeline end time or target duration in seconds"}
                    },
                    "required": ["clipId", "end"]
                }
            },
            {
                "name": "add_transition",
                "description": "Applies a transition effect (e.g. cross_dissolve, fade_black, zoom_in, slide_left) to a clip.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Target clip ID"},
                        "type": {
                            "type": "STRING",
                            "description": "Transition type (e.g. cross_dissolve, fade_black, fade_white, zoom_in, zoom_out, slide_left, push_up)"
                        },
                        "duration": {"type": "NUMBER", "description": "Duration in seconds (e.g. 0.5)"}
                    },
                    "required": ["clipId", "type"]
                }
            },
            {
                "name": "remove_transition",
                "description": "Removes any transition applied to the specified clip.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID to remove transition from"}
                    },
                    "required": ["clipId"]
                }
            },
            {
                "name": "set_overlap",
                "description": "Moves or layers a clip onto another track (e.g. overlay or PIP).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID to overlap"},
                        "targetTrackId": {"type": "STRING", "description": "Track ID (e.g. overlay, video)"},
                        "targetStartTime": {"type": "NUMBER", "description": "Start time on target track"}
                    },
                    "required": ["clipId", "targetTrackId", "targetStartTime"]
                }
            },
            {
                "name": "set_clip_transform",
                "description": "Adjusts scale, opacity, rotation, or position of a clip.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID to transform"},
                        "scale": {"type": "NUMBER", "description": "Scale factor (1.0 = 100%)"},
                        "opacity": {"type": "NUMBER", "description": "Opacity from 0.0 to 1.0"},
                        "rotation": {"type": "NUMBER", "description": "Rotation in degrees"},
                        "positionX": {"type": "NUMBER", "description": "Horizontal position offset"},
                        "positionY": {"type": "NUMBER", "description": "Vertical position offset"}
                    },
                    "required": ["clipId"]
                }
            },
            {
                "name": "reverse_clip",
                "description": "Toggles or sets reverse playback on a clip.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"}
                    },
                    "required": ["clipId"]
                }
            },
            {
                "name": "extract_audio",
                "description": "Separates the audio stream from a video clip into a dedicated audio track.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Source clip ID"}
                    },
                    "required": ["clipId"]
                }
            },
            {
                "name": "add_keyframe",
                "description": "Adds an animation keyframe at a specific time offset for a property.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "timeOffset": {"type": "NUMBER", "description": "Seconds from clip start"},
                        "property": {"type": "STRING", "description": "Property: opacity, scale, rotation, positionX, positionY, volume"},
                        "value": {"type": "NUMBER", "description": "Target numeric value"}
                    },
                    "required": ["clipId", "timeOffset", "property", "value"]
                }
            },
            {
                "name": "remove_keyframe",
                "description": "Removes a specific keyframe by its ID.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "keyframeId": {"type": "STRING", "description": "Keyframe ID"}
                    },
                    "required": ["clipId", "keyframeId"]
                }
            },
            {
                "name": "set_speed",
                "description": "Changes the playback speed multiplier of a clip.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "speed": {"type": "NUMBER", "description": "Speed multiplier (e.g. 0.5, 1.5, 2.0)"}
                    },
                    "required": ["clipId", "speed"]
                }
            },
            {
                "name": "set_audio_volume",
                "description": "Sets the audio volume of a clip.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "volume": {"type": "NUMBER", "description": "Volume from 0.0 to 5.0 (1.0 = 100%)"}
                    },
                    "required": ["clipId", "volume"]
                }
            },
            {
                "name": "mute_clip",
                "description": "Mutes or unmutes a specific clip.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "muted": {"type": "BOOLEAN", "description": "True to mute, False to unmute"}
                    },
                    "required": ["clipId", "muted"]
                }
            },
            {
                "name": "mute_track",
                "description": "Mutes or unmutes an entire track.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "trackId": {"type": "STRING", "description": "Track ID"},
                        "muted": {"type": "BOOLEAN", "description": "True to mute, False to unmute"}
                    },
                    "required": ["trackId", "muted"]
                }
            },
            {
                "name": "freeze_clip",
                "description": "Inserts a freeze frame holding the current image.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "freezeTime": {"type": "NUMBER", "description": "Timestamp to freeze"},
                        "duration": {"type": "NUMBER", "description": "Hold duration in seconds (default 3.0)"}
                    },
                    "required": ["clipId", "freezeTime"]
                }
            },
            {
                "name": "set_cover",
                "description": "Sets the project poster / thumbnail frame at a specific timeline timestamp.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "time": {"type": "NUMBER", "description": "Timeline timestamp in seconds"}
                    },
                    "required": ["time"]
                }
            },
            {
                "name": "replace_clip",
                "description": "Replaces the underlying media of a clip while preserving timing.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID to replace"},
                        "assetId": {"type": "STRING", "description": "New asset ID"},
                        "mediaUrl": {"type": "STRING", "description": "New media URL"}
                    },
                    "required": ["clipId", "assetId", "mediaUrl"]
                }
            },
            {
                "name": "rename_clip",
                "description": "Renames a clip on the timeline.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "name": {"type": "STRING", "description": "New display name"}
                    },
                    "required": ["clipId", "name"]
                }
            },
            {
                "name": "lock_clip",
                "description": "Locks or unlocks a clip from edits.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "locked": {"type": "BOOLEAN", "description": "True to lock, False to unlock"}
                    },
                    "required": ["clipId", "locked"]
                }
            },
            {
                "name": "delete_clip",
                "description": "Deletes a clip from the timeline.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID to delete"}
                    },
                    "required": ["clipId"]
                }
            },
            {
                "name": "set_effects",
                "description": "Applies visual effects (e.g. blur, zoom, glitch, shake) to a clip.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "effects": {
                            "type": "ARRAY",
                            "items": {"type": "OBJECT"},
                            "description": "List of effect objects: [{'type': 'blur'}]"
                        }
                    },
                    "required": ["clipId", "effects"]
                }
            },
            {
                "name": "set_filters",
                "description": "Applies color grading LUTs / filters (e.g. cinematic_lut, teal_and_orange, noir_bw).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Clip ID"},
                        "filters": {
                            "type": "ARRAY",
                            "items": {"type": "OBJECT"},
                            "description": "List of filter objects: [{'type': 'cinematic_lut', 'intensity': 1.0}]"
                        }
                    },
                    "required": ["clipId", "filters"]
                }
            },
            {
                "name": "auto_transcribe_captions",
                "description": "Automatically transcribes spoken dialogue and speech from the video/audio into synchronized subtitle captions on the timeline. Call this tool whenever the user asks to add captions, add subtitles, transcribe dialogue, or caption the video.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Target clip ID to transcribe (optional, defaults to active video clip)"},
                        "language": {"type": "STRING", "description": "Language code (e.g. 'en', 'auto')"}
                    }
                }
            },
            {
                "name": "add_caption",
                "description": "Adds specific, user-provided manual text captions. (Do NOT use this for transcribing speech; use auto_transcribe_captions instead).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "clipId": {"type": "STRING", "description": "Source clip ID"},
                        "captions": {
                            "type": "ARRAY",
                            "items": {"type": "OBJECT"},
                            "description": "List of caption items: [{'text': 'Hello', 'startTime': 0.0, 'endTime': 2.0}]"
                        }
                    },
                    "required": ["clipId", "captions"]
                }
            },
            {
                "name": "set_ratio",
                "description": "Changes the canvas aspect ratio (16:9, 9:16, 1:1, 4:5, 21:9).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "aspectRatio": {"type": "STRING", "description": "Target aspect ratio (e.g. 9:16, 16:9, 1:1)"}
                    },
                    "required": ["aspectRatio"]
                }
            }
        ]
    }
]
