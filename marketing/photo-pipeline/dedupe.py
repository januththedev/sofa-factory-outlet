"""Group near-identical photos (burst shots, WhatsApp copies) and keep the best one of each group.

Perceptual hash (dHash, 16x16) per photo; photos within HAMMING bits of each other in the same folder form a
group. The kept photo is the one with the most pixels, then the sharpest (variance of the Laplacian).
Writes <out>/unique.json: [{ "folder", "keep", "dupes": [...], "w", "h", "sharp" }]

usage: py -3.11 dedupe.py <root> <out_dir>
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageOps

HAMMING = 22  # of 256 bits
EXT = (".jpg", ".jpeg", ".png")


def dhash(img, size=16):
    g = img.convert("L").resize((size + 1, size), Image.LANCZOS)
    a = np.asarray(g, dtype=np.int16)
    return (a[:, 1:] > a[:, :-1]).flatten()


def sharpness(img):
    g = np.asarray(img.convert("L").resize((512, int(512 * img.height / img.width))))
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def main():
    root, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    groups_out = []
    for folder, _dirs, files in os.walk(root):
        photos = sorted(f for f in files if f.lower().endswith(EXT))
        if not photos:
            continue
        items = []
        for f in photos:
            path = os.path.join(folder, f)
            try:
                img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
                img.thumbnail((800, 800))
                full = Image.open(path)
                w, h = full.size
                items.append({"path": path, "hash": dhash(img), "w": w, "h": h, "sharp": sharpness(img)})
            except Exception as error:  # unreadable file: skip it, report it
                print("skip", path, error, flush=True)
        used = [False] * len(items)
        for i, it in enumerate(items):
            if used[i]:
                continue
            members = [i]
            used[i] = True
            for j in range(i + 1, len(items)):
                if not used[j] and int(np.count_nonzero(it["hash"] != items[j]["hash"])) <= HAMMING:
                    members.append(j)
                    used[j] = True
            best = max(members, key=lambda k: (items[k]["w"] * items[k]["h"], items[k]["sharp"]))
            groups_out.append({
                "folder": os.path.relpath(folder, root),
                "keep": items[best]["path"],
                "dupes": [items[k]["path"] for k in members if k != best],
                "w": items[best]["w"], "h": items[best]["h"], "sharp": round(items[best]["sharp"], 1),
            })
        print(f"{os.path.relpath(folder, root)}: {len(items)} photos -> "
              f"{sum(1 for g in groups_out if g['folder'] == os.path.relpath(folder, root))} unique", flush=True)
    with open(os.path.join(out, "unique.json"), "w", encoding="utf-8") as fh:
        json.dump(groups_out, fh, indent=1)
    print("total unique:", len(groups_out))


if __name__ == "__main__":
    main()
