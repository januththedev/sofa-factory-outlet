// Starts the app (production build by default, `--dev` for next dev), waits
// until it answers, runs HTTP checks against it and always shuts it down.
//   npm run build && npm run smoke
//   npm run smoke -- --dev
import { spawn } from 'node:child_process';
import path from 'node:path';

const port = process.env.SMOKE_PORT ?? '3101';
const dev = process.argv.includes('--dev');
const base = `http://localhost:${port}`;
const nextBin = path.join('node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn(process.execPath, [nextBin, dev ? 'dev' : 'start', '-p', port], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
});
let log = '';
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));
let exited = false;
child.on('exit', () => (exited = true));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntilReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`Server exited early:\n${log.slice(-1500)}`);
    try {
      const res = await fetch(`${base}/api/health/`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await sleep(1000);
  }
  throw new Error(`Server not ready after ${timeoutMs / 1000}s:\n${log.slice(-1500)}`);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function run() {
  await waitUntilReady(dev ? 300_000 : 120_000);

  const health = await (await fetch(`${base}/api/health/`)).json();
  check('health: ok + local database + local storage', health.ok === true && health.db === 'pglite' && health.storage === 'local', `${health.db}/${health.storage}`);
  check('health: 35 products (15 published, 20 hidden)', health.products.total === 35 && health.products.published === 15 && health.products.hidden === 20, JSON.stringify(health.products));
  check('health: every product has photos', health.variants.total === 35 && health.variants.withImages === 35, JSON.stringify(health.variants));
  check('health: 14 categories/hubs, 20 hidden-product redirects, owner account', health.categories === 14 && health.redirects === 20 && health.admins === 1, `${health.categories}/${health.redirects}/${health.admins}`);

  const home = await fetch(`${base}/`);
  const html = await home.text();
  check('home: 200 with the brand name', home.status === 200 && html.includes('Sofa Factory Outlet'));
  if (!dev) {
    const policy = home.headers.get('content-security-policy') ?? '';
    check('csp: closed down, no eval, no https upgrade on http://localhost', policy.includes("default-src 'self'") && policy.includes("object-src 'none'") && !policy.includes('unsafe-eval') && !policy.includes('upgrade-insecure-requests'), policy.slice(0, 120));
  }
  const srcMatch = html.match(/<img[^>]+src="(\/blob\/[^"]+\.webp)"/);
  check('home: renders a <picture> with a /blob/ photo', Boolean(srcMatch) && html.includes('<picture'));
  if (srcMatch) {
    const image = await fetch(`${base}${srcMatch[1]}`);
    check('blob: photo is served as WebP', image.status === 200 && image.headers.get('content-type') === 'image/webp', `${image.status} ${image.headers.get('content-type')}`);
    const avif = await fetch(`${base}${srcMatch[1].replace(/\.webp$/, '.avif')}`);
    check('blob: AVIF twin is served', avif.status === 200 && avif.headers.get('content-type') === 'image/avif');
  }
  check('blob: missing key is 404', (await fetch(`${base}/blob/nope/none.webp`)).status === 404);
  check('blob: path traversal is rejected', [400, 404].includes((await fetch(`${base}/blob/..%2F..%2Fpackage.json`)).status));

  const manual = (url) => fetch(`${base}${url}`, { redirect: 'manual' });
  const cat = await manual('/product-category/sofa/');
  check('redirect: /product-category/sofa/ → /sofas/ (301)', cat.status === 301 && new URL(cat.headers.get('location') ?? '', base).pathname === '/sofas/', `${cat.status} ${cat.headers.get('location')}`);
  const coffee = await manual('/product-category/coffee/');
  check('redirect: /product-category/coffee/ → /tables/coffee/ (301)', coffee.status === 301 && new URL(coffee.headers.get('location') ?? '', base).pathname === '/tables/coffee/');
  const checkout = await manual('/checkout/');
  check('redirect: /checkout/ → /book-visit/ (301)', checkout.status === 301 && new URL(checkout.headers.get('location') ?? '', base).pathname === '/book-visit/');
  const slash = await manual('/shop');
  check('trailing slash: /shop → /shop/ (308)', slash.status === 308 && new URL(slash.headers.get('location') ?? '', base).pathname === '/shop/');
}

try {
  await run();
} catch (error) {
  check('smoke run', false, error instanceof Error ? error.message : String(error));
} finally {
  child.kill();
  await sleep(500);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
