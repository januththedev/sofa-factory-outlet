"""Turn the plan files into the processing list: up to MAX photos per colour, best first, as path|name lines."""
import glob, json, os, sys
MAX = int(sys.argv[1]) if len(sys.argv) > 1 else 3
here = os.path.dirname(os.path.abspath(__file__))
index = json.load(open(os.path.join(here, 'catalogue', 'index.json'), encoding='utf-8'))
lines, seen = [], set()
for plan_file in sorted(glob.glob(os.path.join(here, 'catalogue', 'plan-*.json'))):
    plan = json.load(open(plan_file, encoding='utf-8'))
    folder = plan['folder']
    for product in plan['products']:
        for v in product['variants']:
            for n in v['photos'][:MAX]:
                name = f"{folder}-{n}"
                if name in seen:
                    continue
                seen.add(name)
                lines.append(f"{index[folder][n]['path']}|{name}")
open(os.path.join(here, 'catalogue', 'process-list.txt'), 'w', encoding='utf-8').write('\n'.join(lines))
print(len(lines), 'photos to process')
