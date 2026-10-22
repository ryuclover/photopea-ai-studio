"""Build a deterministic before/after GIF from real test images (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "docs" / "media"
SIZE = 560


def font(size):
    for candidate in ("C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def make_frame(before, after, reveal):
    frame = Image.new("RGB", (SIZE, SIZE + 94), "#151923")
    draw = ImageDraw.Draw(frame)
    draw.text((18, 12), "AI Studio para Photopea", fill="#f3f5fa", font=font(20))
    draw.text((18, 40), "ANTES: câmera   /   DEPOIS: planta gerada por IA", fill="#bdc8de", font=font(13))
    frame.paste(before, (0, 68))
    if reveal:
        frame.paste(after.crop((0, 0, reveal, SIZE)), (0, 68))
    if 0 < reveal < SIZE:
        draw.line((reveal, 68, reveal, SIZE + 68), fill="white", width=2)
    draw.text((18, SIZE + 73), "Comparação antes/depois · não é gravação do editor", fill="#bdc8de", font=font(12))
    return frame


def main():
    MEDIA.mkdir(parents=True, exist_ok=True)
    before = Image.open(ROOT / "public" / "case2-camera.png").convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    after = Image.open(MEDIA / "plant-after.png").convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    frames = [make_frame(before, after, 0)]
    frames += [make_frame(before, after, round(SIZE * i / 10)) for i in range(1, 11)]
    atlas = Image.new("RGB", (SIZE * 2, SIZE + 94))
    atlas.paste(frames[0]); atlas.paste(frames[-1], (SIZE, 0))
    palette = atlas.quantize(colors=192)
    quantized = [frame.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG) for frame in frames]
    output = MEDIA / "demo.gif"
    quantized[0].save(output, save_all=True, append_images=quantized[1:], duration=[1800] + [100] * 9 + [2400], loop=0, optimize=True, disposal=2)
    with Image.open(output) as check:
        assert check.n_frames == 11
        assert check.size == (SIZE, SIZE + 94)
        check.seek(check.n_frames - 1)
        check.load()
    print(f"GIF: {output.relative_to(ROOT)} ({output.stat().st_size:,} bytes, 11 frames)")


if __name__ == "__main__":
    main()
