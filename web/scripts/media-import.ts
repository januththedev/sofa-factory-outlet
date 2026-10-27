// Processes the captured originals (../assets/uploads, fetched by
// download-images.ps1) into AVIF + WebP width sets through the storage
// adapter, writes seed/media-manifest.json, and builds the brand files in
// public/brand and src/app (favicons).
//
//   npm run media:import            only new images
//   npm run media:import -- --force reprocess everything
//
// With BLOB_READ_WRITE_TOKEN set the files go to Vercel Blob instead of .data/blob.
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { ImageRef } from '../src/lib/db/schema/types';
import { processImage } from '../src/lib/images/process';
import { BORROWED_IMAGE, CATEGORY_SEEDS, loadCapture, relPath, SUPPLIER_IMAGE } from '../src/lib/seed/capture';
import { storage } from '../src/lib/storage';

const force = process.argv.includes('--force');
const uploadsDir = path.resolve(process.cwd(), process.env.CAPTURE_UPLOADS_DIR || '../assets/uploads');
const brandDir = path.resolve(process.cwd(), process.env.CAPTURE_BRAND_DIR || '../assets/brand');
const manifestFile = path.join(process.cwd(), 'seed', 'media-manifest.json');

/** Editorial images used on the landing, About and collection sections. */
const SITE_IMAGES: Record<string, string> = {
  '2025/11/shoplook01-scaled.jpg': 'site/hero-living-room',
  '2025/11/shoplook03-scaled.jpg': 'site/living-room-2',
  '2025/09/1-scaled.jpg': 'site/banner-1',
  '2025/09/2-scaled.jpg': 'site/banner-2',
  '2025/09/3-scaled.jpg': 'site/banner-3',
  '2025/11/sofa-premium-quality-materials-cover-images.jpg': 'site/materials',
  '2025/11/sofa_factory_outlet_image_01.jpg': 'site/about-banner',
  '2025/11/L-Shape-Sofas.png': 'site/collection-l-shape',
  '2025/11/Recliner-Sofas.png': 'site/collection-recliners',
  '2025/11/Sofa-Sets.png': 'site/collection-sets',
  '2025/11/Fabric-Leather-Sofas.png': 'site/collection-fabric-leather',
};

type Job = { rel: string; keyPrefix: string; alt: string; flag: ImageRef['flag'] };

function collectJobs(): Job[] {
  const { products, media } = loadCapture();
  const altFor = new Map(media.map((m) => [relPath(m.url), m.alt]));
  const jobs = new Map<string, Job>();
  for (const p of products) {
    for (const im of p.images) {
      const rel = relPath(im.src);
      if (jobs.has(rel)) continue;
      jobs.set(rel, {
        rel,
        keyPrefix: `products/${p.id}`,
        alt: im.alt || altFor.get(rel) || '',
        flag: BORROWED_IMAGE.test(rel) ? 'borrowed' : SUPPLIER_IMAGE.test(rel) ? 'licence' : null,
      });
    }
  }
  for (const c of CATEGORY_SEEDS) {
    if (c.image && !jobs.has(c.image)) jobs.set(c.image, { rel: c.image, keyPrefix: `categories/${c.slug}`, alt: c.name, flag: null });
  }
  for (const [rel, keyPrefix] of Object.entries(SITE_IMAGES)) {
    if (!jobs.has(rel)) jobs.set(rel, { rel, keyPrefix, alt: altFor.get(rel) ?? '', flag: null });
  }
  return [...jobs.values()];
}

async function exists(key: string) {
  return (await storage().get(key)) !== null;
}

async function importPhotos() {
  const manifest: { version: 1; generatedAt: string; items: Record<string, ImageRef> } = fs.existsSync(manifestFile)
    ? JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    : { version: 1, generatedAt: '', items: {} };

  const jobs = collectJobs();
  let done = 0;
  let skipped = 0;
  const missing: string[] = [];
  for (const job of jobs) {
    const file = path.join(uploadsDir, ...job.rel.split('/'));
    if (!fs.existsSync(file)) {
      missing.push(job.rel);
      continue;
    }
    const known = manifest.items[job.rel];
    if (!force && known && (await exists(`${known.key}/${known.widths[0]}.webp`))) {
      skipped += 1;
      continue;
    }
    const ref = await processImage(fs.readFileSync(file), { keyPrefix: job.keyPrefix, alt: job.alt, flag: job.flag, source: job.rel });
    manifest.items[job.rel] = ref;
    done += 1;
    process.stdout.write(`\r  processed ${done} (${job.rel.slice(0, 60)})`.padEnd(100));
  }
  process.stdout.write('\n');

  manifest.generatedAt = new Date().toISOString();
  manifest.items = Object.fromEntries(Object.entries(manifest.items).sort(([a], [b]) => a.localeCompare(b)));
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`media: ${done} processed, ${skipped} unchanged, ${missing.length} missing originals`);
  if (missing.length) {
    console.log('  Missing (run ../download-images.ps1 first):');
    for (const m of missing) console.log(`   - ${m}`);
  }
}

/** Bounding box of the brown circle in the logo (pixels close to #53352A). */
async function findMarkBox(input: Buffer) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  // The mark sits in the left part of the lock-up. Require a real brown
  // (red clearly above blue) so the dark-grey anti-aliasing of the black
  // lettering is not mistaken for the circle.
  const limit = Math.floor(info.width * 0.3);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < limit; x += 1) {
      const i = (y * info.width + x) * 4;
      const d = Math.abs(data[i] - 0x53) + Math.abs(data[i + 1] - 0x35) + Math.abs(data[i + 2] - 0x2a);
      if (d < 60 && data[i] - data[i + 2] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, imageWidth: info.width };
}

async function buildBrand() {
  const source = path.join(brandDir, 'Mr.Amzar-Logo-Vector-file.ai_-1-scaled.png');
  if (!fs.existsSync(source)) {
    console.log('brand: logo not found, skipped');
    return;
  }
  const input = fs.readFileSync(source);
  const publicBrand = path.join(process.cwd(), 'public', 'brand');
  fs.mkdirSync(publicBrand, { recursive: true });

  // The circular mark keeps its white chair drawing: mask the square crop with a circle
  // instead of turning every white pixel transparent.
  const box = await findMarkBox(input);
  const size = Math.max(box.width, box.height);
  const square = await sharp(input)
    .extract({ left: box.left, top: box.top, width: size, height: size })
    .ensureAlpha()
    .toBuffer();
  const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
  const mark = await sharp(square).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer();
  await sharp(mark).resize(512, 512).png().toFile(path.join(publicBrand, 'mark.png'));

  // Favicon and Apple touch icon: centred mark (the old site icon sat 26px off-centre).
  const appDir = path.join(process.cwd(), 'src', 'app');
  await sharp(mark).resize(512, 512).png().toFile(path.join(appDir, 'icon.png'));
  const apple = await sharp(mark).resize(148, 148).png().toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: '#F3EFE8' } })
    .composite([{ input: apple, gravity: 'centre' }])
    .png()
    .toFile(path.join(appDir, 'apple-icon.png'));

  // Wordmark: the black lettering, with the white background made transparent.
  const textLeft = box.left + size + Math.round(size * 0.15);
  const meta = await sharp(input).metadata();
  // sharp trims before it extracts within one pipeline, so crop first, then trim.
  const textRegion = await sharp(input)
    .extract({ left: textLeft, top: 0, width: (meta.width ?? box.imageWidth) - textLeft, height: meta.height ?? size })
    .png()
    .toBuffer();
  const wordmark = await sharp(textRegion).trim({ background: '#ffffff', threshold: 20 }).unflatten().png().toBuffer();
  await sharp(wordmark).png().toFile(path.join(publicBrand, 'wordmark.png'));
  await sharp(wordmark).negate({ alpha: false }).png().toFile(path.join(publicBrand, 'wordmark-light.png'));

  // Full lock-up on a transparent background, for invoices and share images.
  const wm = await sharp(wordmark).metadata();
  const gap = Math.round(size * 0.18);
  const height = Math.max(size, wm.height ?? size);
  await sharp({
    create: { width: size + gap + (wm.width ?? 0), height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: mark, left: 0, top: Math.round((height - size) / 2) },
      { input: wordmark, left: size + gap, top: Math.round((height - (wm.height ?? 0)) / 2) },
    ])
    .png()
    .toFile(path.join(publicBrand, 'logo.png'));
  console.log('brand: public/brand/{mark,wordmark,wordmark-light,logo}.png and src/app/{icon,apple-icon}.png written');
}

async function main() {
  console.log(`media: originals from ${uploadsDir}, storage = ${storage().kind}`);
  await importPhotos();
  await buildBrand();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
