"""Compare background-removal models on a few hard photos; writes one sheet per photo (original | model A | model B ...)."""
import os
import sys
import time

from PIL import Image, ImageOps
from rembg import new_session, remove

out = sys.argv[1]
models = sys.argv[2].split(",")
photos = sys.argv[3:]
os.makedirs(out, exist_ok=True)
sessions = {m: new_session(m) for m in models}
for path in photos:
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    img.thumbnail((1600, 1600))
    tiles = [img]
    for m in models:
        start = time.time()
        cut = remove(img, session=sessions[m])
        took = time.time() - start
        bg = Image.new("RGB", img.size, (240, 236, 228))
        bg.paste(cut, (0, 0), cut)
        tiles.append(bg)
        print(f"{os.path.basename(path)} {m}: {took:.1f}s", flush=True)
    w, h = tiles[0].size
    sheet = Image.new("RGB", (w * len(tiles), h), (20, 20, 20))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * w, 0))
    sheet.thumbnail((2400, 2400))
    sheet.save(os.path.join(out, os.path.splitext(os.path.basename(path))[0].replace(" ", "_") + ".jpg"), quality=75)
