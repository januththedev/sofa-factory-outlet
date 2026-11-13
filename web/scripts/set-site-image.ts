// Processes a photo into the AVIF/WebP widths the pages use, writes the files to public/media and records it
// in seed/media-manifest.json under a name the site images point at (src/lib/images/site.ts).
//   npx tsx scripts/set-site-image.ts <photo file> <manifest name> <key prefix, e.g. site/hero-navy-set> "<alt text>"
import './_env';
import fs from 'node:fs';
import path from 'node:path';

process.env.BLOB_READ_WRITE_TOKEN = '';
process.env.LOCAL_BLOB_DIR = 'public/media';

async function main() {
  const [file, name, keyPrefix, alt] = process.argv.slice(2);
  if (!file || !name || !keyPrefix || !alt) throw new Error('usage: set-site-image.ts <file> <name> <keyPrefix> "<alt>"');
  const { processImage } = await import('../src/lib/images/process');
  const ref = await processImage(fs.readFileSync(file), { keyPrefix, alt, source: name });
  const manifestFile = path.join(process.cwd(), 'seed', 'media-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.items[name] = ref;
  manifest.items = Object.fromEntries(Object.entries(manifest.items).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${name} -> ${ref.key} (${ref.widths.join(', ')})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
