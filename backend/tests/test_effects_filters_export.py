import pytest
from app.engine.compiler import TimelineCompiler
from app.schemas.timeline import TimelineExportRequest, TrackSchema, ClipSchema, FilterSchema, EffectSchema
from app.engine.plugins.filters_color import ColorFilterPlugin
from app.engine.plugins.effects import EffectsPlugin

ALL_20_FILTERS = [
    "hollywood_gold", "cinematic_lut", "teal_and_orange", "moody_film",
    "bright_pop", "deep_contrast", "natural_tone",
    "natural_skin", "beauty_soft", "fashion_look",
    "film_grain", "vhs_classic",
    "pure_mono", "noir_bw",
    "forest_green", "ocean_blue",
    "neon_blue", "cyberpunk",
    "oil_painting", "comic_book"
]

ALL_20_EFFECTS = [
    "fade_in", "fade_out", "zoom_in", "zoom_out", "spin",
    "drop", "move_left", "move_right", "move_up", "move_down",
    "shake_in", "zoom_bounce", "pulse", "pop_in", "pop_out",
    "expand", "collapse", "swing", "bounce", "wiggle"
]

def test_filters_color_export_compiles_all_20_recipes():
    compiler = TimelineCompiler()
    for ftype in ALL_20_FILTERS:
        request = TimelineExportRequest(
            tracks=[TrackSchema(id="t1", label="Video 1", type="video", clipIds=["c1"])],
            clips=[
                ClipSchema(
                    id="c1",
                    trackId="t1",
                    start=0.0,
                    duration=4.0,
                    mediaUrl="https://example.com/video.mp4",
                    filters=[FilterSchema(type=ftype, intensity=1.0)]
                )
            ]
        )
        cmd, duration = compiler.compile(request, "output.mp4")
        fc_idx = cmd.index("-filter_complex") + 1
        filter_complex = cmd[fc_idx]
        assert len(filter_complex) > 0, f"Filter {ftype} failed to compile"

def test_effects_export_compiles_all_20_effects():
    compiler = TimelineCompiler()
    for eff in ALL_20_EFFECTS:
        request = TimelineExportRequest(
            tracks=[TrackSchema(id="t1", label="Video 1", type="video", clipIds=["c1"])],
            clips=[
                ClipSchema(
                    id="c1",
                    trackId="t1",
                    start=0.0,
                    duration=5.0,
                    mediaUrl="https://example.com/video.mp4",
                    effects=[EffectSchema(type=eff, parameters={})]
                )
            ]
        )
        cmd, duration = compiler.compile(request, "output.mp4")
        fc_idx = cmd.index("-filter_complex") + 1
        filter_complex = cmd[fc_idx]
        assert len(filter_complex) > 0, f"Effect {eff} failed to compile"
