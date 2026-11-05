You are worker __K__ of 3 preparing product photos for the Sofa Factory Outlet website (a sofa maker in Colombo).
Your job list is `codex-queue/worker-__K__.json` in the current folder (D:\Sofa_Factory\marketing\photo-pipeline). It is an
ordered JSON array: each item has `name` (the output name), `source` (a real workshop photo), `product` and `colour`.
Work through it IN ORDER, from the first item. Do not reorder and do not stop early.

For each item:
1. If `codex-cutouts/<name>.png` already exists, skip the item (this makes the job resumable).
2. Look at the source photo with view_image.
3. Call the built-in ImageGen tool to edit that photo, with the source path and `transparent_background: true`:
   remove the background, floor, walls, people and any unrelated furniture; keep ONLY the product (and the rest of the set
   when the photo shows a set: all seats, ottomans, side tables, cushions). Preserve exactly what is in the photo: the
   arrangement, the shape, the fabric or leather and its true colour, the number of cushions, buttons and legs, and the
   framing. Do not redesign, improve, tidy or add anything. No text, logos or watermarks.
4. Copy the generated PNG to `codex-cutouts/<name>.png` immediately (the original generated file lives on drive C: which is
   nearly full, so never leave results only there).
5. Check the saved file: it must be a PNG with a transparent background and the whole product visible (nothing cut off that
   was not cut off in the photo, no leftover background patches). If it is bad, make ONE more attempt with a corrected prompt;
   if it is still bad, delete the file and append the name to `codex-queue/worker-__K__.failed.txt` and move on.
6. Append one line `<name>` to `codex-queue/worker-__K__.done.txt` after each good file.

Rules:
- Use ONLY the built-in ImageGen tool for the cut-outs (no rembg, no other background remover, no API calls).
- Only write inside `codex-cutouts/` and `codex-queue/`. Do not modify any other file or folder.
- If ImageGen reports a usage limit or quota error, stop at once, write the reset time and the next item's name to
  `codex-queue/worker-__K__.limit.txt`, and finish.
- Keep your replies short. When the list is finished (or you stop because of the limit), reply with: how many done, how many
  failed, and the next item not done.
