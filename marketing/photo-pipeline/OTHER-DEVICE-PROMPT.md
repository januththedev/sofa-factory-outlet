You are helping Sofa Factory Outlet (a sofa maker in Colombo) turn real workshop photos into clean product
images for their website. This computer has the photo folder "To Transfer (1)" (subfolders "SOFA SETS/...").
I have attached a bundle with three files: process.py, lowmem.py and process-list-relative.txt.

GOAL
Process exactly the 568 photos listed in process-list-relative.txt (format: relative/path/to/photo.jpg|output_name).
For each photo: straighten it (EXIF), upscale small photos 2x, cut the sofa (or chair/bed/ottoman) out of its
background, correct the light a little, and place it on a soft studio background with a floor shadow.
process.py already does all of this; your job is to run it well, check every result, and fix the bad ones.

SETUP
1. Find the "To Transfer (1)" folder on this computer and confirm a few listed paths exist.
2. Python 3.10 or 3.11: pip install "rembg[cpu]" opencv-contrib-python-headless pillow
   (with an NVIDIA GPU use "rembg[gpu]" instead; it is many times faster).
3. Put process.py, lowmem.py and process-list-relative.txt in one working folder.

RUN
- Best quality (8 GB+ free RAM or a GPU):
  SFO_MODEL=birefnet-general SFO_THREADS=<cpu cores> python process.py <out_dir> --root "<path to To Transfer (1)>" --list process-list-relative.txt
- If it runs out of memory, use SFO_MODEL=birefnet-general-lite.
- On Windows PowerShell set the variables with $env:SFO_MODEL="birefnet-general" first.
- It is resumable: re-running skips photos already in <out_dir>/studio. The first run downloads the model.
- Output per photo: <out_dir>/studio/<name>.jpg (1600x1200 on the studio background),
  <out_dir>/cutout/<name>.png (transparent), <out_dir>/review/<name>.jpg (before | after).

CHECK EVERY RESULT (look at the review images)
A result is good when the whole product is there (all seats, arms, cushions, legs, ottomans and side tables
of the set), the edge is clean, and no grass, floor, wall, people or other furniture is left.
Common problems and fixes:
- Grass or gravel fringe along the bottom edge: clean the mask's lower edge; keep legs.
- Parts missing (dark sofas, white sofas on white floors): try the other model on that photo, or run rembg
  with alpha matting, or refine the mask by hand (e.g. with a flood-fill or GrabCut seeded from the mask).
- Background patches left inside the product (gaps between cushions): remove them.
- Product cut off by the original photo frame: keep it, but list it as "cropped in original".
To redo one photo, delete its files in studio/, cutout/ and review/ and run again with a list holding just that line.

RULES (important)
- Never repaint, redraw, extend or "improve" the furniture with generative AI: no generative fill, no
  invented legs, cushions or fabric. Customers must see the real product exactly as made.
- Keep the true fabric colours (no strong filters). Light brightness/contrast correction only.
- Do not add text, logos or watermarks. Keep the output file names exactly as they are.

DELIVER
1. A zip of <out_dir>/studio and <out_dir>/cutout (same file names, same folder names).
2. A short report: how many photos are good, which names you fixed and how, and which are still poor
   or "cropped in original".
