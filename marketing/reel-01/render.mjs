// Renders index.html to a 1080x1920, 30 fps MP4 with its music.
// usage (from web/ so playwright resolves): node ../marketing/reel-01/render.mjs <frames_dir> <ffmpeg_exe>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL('D:/Sofa_Factory/web/node_modules/playwright-core/index.mjs').href);
const here = 'D:/Sofa_Factory/marketing/reel-01';
const frames = process.argv[2];
const ffmpeg = process.argv[3];
const FPS = 30, DURATION = 30;
fs.mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, 'index.html')).href + '?capture=1', { waitUntil: 'load', timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
// Background images: preload every url(...) so no frame shows a half-loaded photo.
await page.evaluate(() => Promise.all([...document.querySelectorAll('[style*="url("]')].map((el) => {
  const m = el.style.backgroundImage.match(/url\("?(.*?)"?\)/);
  if (!m) return null;
  const img = new Image(); img.src = m[1]; return img.decode().catch(() => {});
})));

const total = FPS * DURATION;
const started = Date.now();
for (let i = 0; i < total; i++) {
  const file = path.join(frames, `f${String(i).padStart(4, '0')}.jpg`);
  // Resumable: frames already on disk from an earlier run are kept.
  if (fs.existsSync(file) && fs.statSync(file).size > 10_000) continue;
  await page.evaluate((t) => window.renderFrame(t), i / FPS);
  for (let attempt = 1; ; attempt++) {
    try {
      await page.screenshot({ path: file, type: 'jpeg', quality: 93 });
      break;
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  if (i % 150 === 0) console.log(`frame ${i}/${total} ${Math.round((Date.now() - started) / 1000)}s`);
}
const wav = await page.evaluate(() => window.renderAudioWav());
fs.writeFileSync(path.join(here, 'music.wav'), Buffer.from(wav, 'base64'));
await browser.close();

execFileSync(ffmpeg, [
  '-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.jpg'),
  '-i', path.join(here, 'music.wav'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
  path.join(here, 'sofa-factory-reel.mp4'),
], { stdio: 'inherit' });
console.log('done', Math.round((Date.now() - started) / 1000), 's');
