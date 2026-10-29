"""Write catalogue/process-list-relative.txt: the processing list with paths relative to the
"To Transfer (1)" folder, forward slashes, so another computer can use its own copy of the photos."""
lines = open("catalogue/process-list.txt", encoding="utf-8").read().splitlines()
out = []
for line in lines:
    path, _, name = line.partition("|")
    rel = path.replace(chr(92), "/").split("To Transfer (1)/", 1)[1]
    out.append(f"{rel}|{name}")
with open("catalogue/process-list-relative.txt", "w", encoding="utf-8", newline="\n") as fh:
    fh.write("\n".join(out) + "\n")
print(len(out), out[0], out[-1], sep="\n")
