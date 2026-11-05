"""Turn Codex (ImageGen) transparent cut-outs into studio shots for the product listings.

Reads two sources of cut-outs:
  1. the background-removal manifest written by the Codex photo session (img-XXXX ids -> source photo -> ready PNG)
  2. <root>/codex-cutouts/<folder>-<n>.png, made by the listing-priority Codex run (see codex_queue.py)
and writes  <root>/catalogue/processed/studio-codex/<folder>-<n>.jpg  (1600x1200, same studio background as
process.py). The importer (web/scripts/import-photo-catalogue.ts) prefers these over processed/studio.

  python codex_studio.py [--manifest PATH] [--bg-root PATH] [--force]
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(HERE, "catalogue")
OUT = os.path.join(CAT, "processed", "studio-codex")
EXTRA = os.path.join(HERE, "codex-cutouts")
STUDIO_SIZE = (1600, 1200)
BG_TOP, BG_BOTTOM = (251, 249, 245), (234, 227, 216)
BS = chr(92)


def rel(path):
    path = path.replace(BS, "/")
    i = path.find("To Transfer (1)/")
    return (path[i + len("To Transfer (1)/"):] if i >= 0 else path).lower()


def studio(cut):
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
    sh = np.zeros((H, W), np.uint8)
    cv2.ellipse(sh, (W // 2, y + h - 6), (int(w * 0.52), max(14, int(h * 0.06))), 0, 0, 360, 120, -1)
    shadow = Image.fromarray(cv2.GaussianBlur(sh, (0, 0), 28))
    dark = Image.new("RGB", (W, H), (60, 48, 40))
    bg = Image.composite(dark, bg, shadow.point(lambda v: int(v * 0.55)))
    bg.paste(piece, (x, y), piece)
    return bg


def trimmed(path):
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop(box) if box else im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bg-root", default="D:/Sofa_Factory-reels/marketing/background-removal")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    index = json.load(open(os.path.join(CAT, "index.json"), encoding="utf-8"))
    by_rel = {}
    for folder, items in index.items():
        for it in items:
            by_rel[rel(it["path"])] = f"{folder}-{it['n']}"

    sources = {}  # name -> png path
    manifest = os.path.join(args.bg_root, "manifest.json")
    if os.path.exists(manifest):
        for e in json.load(open(manifest, encoding="utf-8"))["images"]:
            if e.get("status") != "ready" or not e.get("output"):
                continue
            png = os.path.join(args.bg_root, e["output"])
            if not os.path.exists(png):
                continue
            for s in e["sources"]:
                name = by_rel.get(s.replace(BS, "/").lower())
                if name:
                    sources[name] = png
    if os.path.isdir(EXTRA):
        for f in os.listdir(EXTRA):
            if f.lower().endswith(".png"):
                sources[os.path.splitext(f)[0]] = os.path.join(EXTRA, f)

    os.makedirs(OUT, exist_ok=True)
    done = skipped = 0
    for name, png in sorted(sources.items()):
        dst = os.path.join(OUT, name + ".jpg")
        if os.path.exists(dst) and not args.force and os.path.getmtime(dst) >= os.path.getmtime(png):
            skipped += 1
            continue
        try:
            studio(trimmed(png)).save(dst, quality=92)
            done += 1
        except Exception as exc:  # a half-written PNG from a worker still running
            print(f"skip {name}: {exc}", file=sys.stderr)
    print(f"studio-codex: {done} written, {skipped} up to date, {len(sources)} cut-outs known")


if __name__ == "__main__":
    main()
