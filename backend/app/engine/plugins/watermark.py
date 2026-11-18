from PIL import Image

from app.engine.models import CompilationContext, FilterNode, RenderWatermark


def apply_watermark(
    context: CompilationContext, video_stream: str, watermark: RenderWatermark
) -> str:
    try:
        with Image.open(watermark.path, formats=["PNG"]) as image:
            logo_aspect_ratio = image.width / image.height
            image.load()
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as error:
        raise ValueError("The watermark image is missing or invalid.") from error

    # Keep placement consistent with the editor's fitWatermarkToFrame helper.
    inset = 0.03
    usable_fraction = 1 - inset * 2
    height_per_width = (context.width / context.height) / logo_aspect_ratio
    max_width = min(0.6, usable_fraction / height_per_width)
    width = min(max_width, max(min(0.03, max_width), watermark.width))
    height = width * height_per_width
    x = min(1 - inset - width, max(inset, watermark.x))
    y = min(1 - inset - height, max(inset, watermark.y))

    logo_input = context.register_input_file(str(watermark.path))
    scaled = context.generate_label("watermark_scaled")
    rgba = context.generate_label("watermark_rgba")
    translucent = context.generate_label("watermark_alpha")
    output = context.generate_label("watermark_composite")
    context.add_node(FilterNode("scale", [f"{logo_input}:v"], [scaled], {
        "w": str(max(1, round(width * context.width))),
        "h": str(max(1, round(height * context.height))),
    }))
    context.add_node(FilterNode("format", [scaled], [rgba], {"pix_fmts": "rgba"}))
    context.add_node(FilterNode("colorchannelmixer", [rgba], [translucent], {"aa": str(watermark.opacity)}))
    context.add_node(FilterNode("overlay", [video_stream, translucent], [output], {
        "x": str(round(x * context.width)),
        "y": str(round(y * context.height)),
        "format": "yuv444",
        "alpha": "straight",
        "eof_action": "repeat",
        "repeatlast": "1",
    }))
    return output
