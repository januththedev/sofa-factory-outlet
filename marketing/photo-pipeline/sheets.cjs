// Contact sheets of the unique photos, per folder, 10x8 numbered thumbnails, in date (file name) order.
const sharp = require('D:/Sofa_Factory/web/node_modules/sharp');
const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const unique = JSON.parse(fs.readFileSync('D:/Sofa_Factory/marketing/photo-pipeline/catalogue/unique.json', 'utf8'));
const byFolder = {};
for (const u of unique) (byFolder[u.folder] ??= []).push(u);
const index = {};
(async () => {
  for (const [folder, items] of Object.entries(byFolder)) {
    items.sort((a, b) => path.basename(a.keep).localeCompare(path.basename(b.keep)));
    const slug = folder.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    index[slug] = items.map((u, i) => ({ n: i, path: u.keep, w: u.w, h: u.h, dupes: u.dupes.length }));
    const W = 192, H = 144, cols = 10, per = 80;
    for (let s = 0; s * per < items.length; s++) {
      const chunk = items.slice(s * per, s * per + per);
      const tiles = (await Promise.all(chunk.map(async (u, i) => {
        try {
          const n = s * per + i;
          const img = await sharp(u.keep, { failOn: 'none' }).rotate().resize(W, H, { fit: 'cover' }).toBuffer();
          const label = Buffer.from(`<svg width="${W}" height="${H}"><rect width="40" height="20" fill="#000"/><text x="3" y="15" font-size="14" fill="#fff" font-family="Arial">${n}</text></svg>`);
          return { input: await sharp(img).composite([{ input: label, top: 0, left: 0 }]).toBuffer(), left: (i % cols) * W, top: Math.floor(i / cols) * H };
        } catch { return null; }
      }))).filter(Boolean);
      await sharp({ create: { width: cols * W, height: Math.ceil(chunk.length / cols) * H, channels: 3, background: '#222' } })
        .composite(tiles).jpeg({ quality: 62 }).toFile(path.join(out, `${slug}-${s + 1}.jpg`));
    }
    console.log(slug, items.length, Math.ceil(items.length / per), 'sheet(s)');
  }
  fs.writeFileSync('D:/Sofa_Factory/marketing/photo-pipeline/catalogue/index.json', JSON.stringify(index, null, 1));
})();
