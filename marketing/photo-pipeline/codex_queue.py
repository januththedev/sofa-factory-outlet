"""Build the Codex work queue for the product listings: only the photos the listings use, hero shots first.

Writes codex-queue/queue-all.json (ordered) and codex-queue/worker-<k>.json (k = 1..N, round-robin so every
worker starts with hero shots). Photos that already have a cut-out (background-removal manifest or
codex-cutouts/) are left out.

  python codex_queue.py [--workers 3] [--bg-root PATH]
"""
import argparse
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(HERE, "catalogue")
BS = chr(92)


def rel(path):
    path = path.replace(BS, "/")
    i = path.find("To Transfer (1)/")
    return (path[i + len("To Transfer (1)/"):] if i >= 0 else path).lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--bg-root", default="D:/Sofa_Factory-reels/marketing/background-removal")
    args = ap.parse_args()

    index = json.load(open(os.path.join(CAT, "index.json"), encoding="utf-8"))
    path_of = {}
    by_rel = {}
    for folder, items in index.items():
        for it in items:
            name = f"{folder}-{it['n']}"
            path_of[name] = it["path"].replace(BS, "/")
            by_rel[rel(it["path"])] = name

    have = set()
    manifest = os.path.join(args.bg_root, "manifest.json")
    if os.path.exists(manifest):
        for e in json.load(open(manifest, encoding="utf-8"))["images"]:
            if e.get("status") == "ready":
                for s in e["sources"]:
                    n = by_rel.get(s.replace(BS, "/").lower())
                    if n:
                        have.add(n)
    extra = os.path.join(HERE, "codex-cutouts")
    if os.path.isdir(extra):
        have |= {os.path.splitext(f)[0] for f in os.listdir(extra) if f.lower().endswith(".png")}

    ranked = []  # (rank, name, product, colour)
    seen = set()
    for f in sorted(glob.glob(os.path.join(CAT, "plan-*.json"))):
        plan = json.load(open(f, encoding="utf-8"))
        for prod in plan["products"]:
            for v in prod["variants"]:
                for rank, n in enumerate(v["photos"][:4]):
                    name = f"{plan['folder']}-{n}"
                    if name in have or name in seen or name not in path_of:
                        continue
                    seen.add(name)
                    ranked.append((rank, name, prod["name"], v["colour"]))
    ranked.sort(key=lambda r: r[0])

    out = os.path.join(HERE, "codex-queue")
    os.makedirs(out, exist_ok=True)
    rows = [{"name": n, "source": path_of[n], "product": p, "colour": c, "rank": r} for r, n, p, c in ranked]
    json.dump(rows, open(os.path.join(out, "queue-all.json"), "w", encoding="utf-8"), indent=1)
    for k in range(args.workers):
        json.dump(rows[k::args.workers], open(os.path.join(out, f"worker-{k + 1}.json"), "w", encoding="utf-8"), indent=1)
    heroes = sum(1 for r in rows if r["rank"] == 0)
    print(f"{len(rows)} photos to do ({heroes} hero shots), {len(have)} already have cut-outs; split across {args.workers} workers")


if __name__ == "__main__":
    main()
