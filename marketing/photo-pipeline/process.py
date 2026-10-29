"""Turn raw sofa photos into clean product images.

For each input photo: straighten (EXIF), upscale small photos 2x with a super-resolution model, cut the sofa
out of its background, tidy the mask, correct the light a little, and place it on a soft studio background
with a floor shadow. Writes, per photo:
  <out>/studio/<name>.jpg   1600x1200 product shot on the studio background
  <out>/cutout/<name>.png   transparent cut-out (trimmed), for the reel and future layouts
  <out>/review/<name>.jpg   before | after side by side, for checking

usage: py -3.11 process.py <out_dir> <photo> [<photo> ...]
       py -3.11 process.py <out_dir> --list files.txt
"""
import os
import sys
import urllib.request

import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageOps, ImageEnhance
from rembg import remove

from lowmem import low_memory_session

HERE = os.path.dirname(os.path.abspath(__file__))
SR_MODEL = os.path.join(HERE, "models", "FSRCNN_x2.pb")
SR_URL = "https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x2.pb"
STUDIO_SIZE = (1600, 1200)
BG_TOP, BG_BOTTOM = (251, 249, 245), (234, 227, 216)  # paper to bone-2, the site's colours


def upscaler():
    os.makedirs(os.path.dirname(SR_MODEL), exist_ok=True)
    if not os.path.exists(SR_MODEL):
        urllib.request.urlretrieve(SR_URL, SR_MODEL)
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(SR_MODEL)
    sr.setModel("fsrcnn", 2)
    return sr


def load(path):
    img = Image.open(path)
    img = ImageOps.exif_transpose(img).convert("RGB")
    return img


def upscale(img, sr, target=1600):
    """2x super-resolution when the long side is under `target` (the studio shot's width), then cap it at 2000:
    the cut-out model works at 1024 px, so larger only costs time."""
    if max(img.size) < target:
        arr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        arr = sr.upsample(arr)
        img = Image.fromarray(cv2.cvtColor(arr, cv2.COLOR_BGR2RGB))
    if max(img.size) > 2000:
        img.thumbnail((2000, 2000), Image.LANCZOS)
    return img


def clean_mask(alpha):
    """Keep the largest solid shape (the sofa), drop specks, fill pinholes, soften the edge slightly."""
    a = np.array(alpha)
    hard = (a > 40).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    if n > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        biggest = areas.max()
        keep = np.zeros_like(hard)
        for i, area in enumerate(areas, start=1):
            # Keep anything at least 4% of the main shape: cushions, ottomans and side tables of the set.
            if area >= biggest * 0.01:
                keep[labels == i] = 1
        a = np.where(keep == 1, a, 0).astype(np.uint8)
    # Grass and gravel leave thin spikes along the bottom edge. Open the lower quarter of the shape with a wide,
    # short kernel: blades (a few px wide) go, legs and solid bases stay.
    ys, xs = np.nonzero(a > 40)
    if len(ys):
        top, bottom = ys.min(), ys.max()
        band = max(top, bottom - (bottom - top) // 4)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 5))
        lower = cv2.morphologyEx(a[band:bottom + 1], cv2.MORPH_OPEN, kernel)
        a[band:bottom + 1] = lower
    return Image.fromarray(a)


def correct(img):
    img = ImageOps.autocontrast(img, cutoff=0.5, preserve_tone=True)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    img = ImageEnhance.Color(img).enhance(1.06)
    return img.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=3))


def studio(cut):
    """Place a trimmed RGBA cut-out on the studio background with a soft floor shadow."""
    W, H = STUDIO_SIZE
    grad = np.zeros((H, W, 3), np.float32)
    for c in range(3):
        grad[:, :, c] = np.linspace(BG_TOP[c], BG_BOTTOM[c], H)[:, None]
    bg = Image.fromarray(grad.astype(np.uint8))

    pad_x, pad_top, pad_bottom = 110, 120, 150
    scale = min((W - 2 * pad_x) / cut.width, (H - pad_top - pad_bottom) / cut.height)
    w, h = max(1, int(cut.width * scale)), max(1, int(cut.height * scale))
    piece = cut.resize((w, h), Image.LANCZOS)
    x, y = (W - w) // 2, H - pad_bottom - h

    shadow = Image.new("L", (W, H), 0)
    sh = np.zeros((H, W), np.uint8)
    cv2.ellipse(sh, (W // 2, y + h - 6), (int(w * 0.52), max(14, int(h * 0.06))), 0, 0, 360, 120, -1)
    shadow = Image.fromarray(cv2.GaussianBlur(sh, (0, 0), 28))
    dark = Image.new("RGB", (W, H), (60, 48, 40))
    bg = Image.composite(dark, bg, shadow.point(lambda v: int(v * 0.55)))

    bg.paste(piece, (x, y), piece)
    return bg


def side_by_side(before, after, height=600):
    b = before.copy(); b.thumbnail((10_000, height))
    a = after.copy(); a.thumbnail((10_000, height))
    out = Image.new("RGB", (b.width + a.width + 20, height), (30, 30, 30))
    out.paste(b, (0, 0)); out.paste(a, (b.width + 20, 0))
    return out


def main():
    out = sys.argv[1]
    args = sys.argv[2:]
    if args[:1] == ["--list"]:
        with open(args[1], encoding="utf-8") as f:
            args = [line.strip() for line in f if line.strip()]
    for sub in ("studio", "cutout", "review"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    sr = upscaler()
    session = low_memory_session("birefnet-general-lite", threads=4)
    for i, entry in enumerate(args, 1):
        # A line may be "path|name" so photos from different folders never share an output name.
        path, _, name = entry.partition("|")
        name = name or os.path.splitext(os.path.basename(path))[0].replace(" ", "_")
        if os.path.exists(os.path.join(out, "studio", name + ".jpg")):
            continue
        try:
            raw = load(path)
            big = upscale(raw, sr)
            cut = remove(big, session=session, post_process_mask=True)
            alpha = clean_mask(cut.getchannel("A"))
            rgb = correct(big)
            cut = rgb.convert("RGBA"); cut.putalpha(alpha)
            box = alpha.getbbox()
            if not box:
                print(f"[{i}/{len(args)}] {name}: nothing found", flush=True)
                continue
            cut = cut.crop(box)
            cut.save(os.path.join(out, "cutout", name + ".png"), optimize=True)
            shot = studio(cut)
            shot.save(os.path.join(out, "studio", name + ".jpg"), quality=90, optimize=True)
            side_by_side(raw, shot).save(os.path.join(out, "review", name + ".jpg"), quality=80)
            print(f"[{i}/{len(args)}] {name}: {raw.size} -> {big.size}, cut {cut.size}", flush=True)
        except Exception as error:  # one bad file must not stop the batch
            print(f"[{i}/{len(args)}] {name}: FAILED {error}", flush=True)


if __name__ == "__main__":
    main()
