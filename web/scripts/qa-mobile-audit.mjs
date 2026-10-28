// Phone and tablet audit. Loads each page at 360, 390, 768 and 1280 px against a RUNNING server (npm run build,
// then npm run start, or the e2e server) and reports, per page: sideways page scroll, tappable elements under
// 40 px, controls cut off by the screen edge, text under 12 px, broken images, console errors, load time.
// It measures instead of eyeballing: two real phone bugs (a 959 px wide home page and a menu button 9 px past the
// edge) were found this way.
//   node scripts/qa-mobile-audit.mjs http://localhost:3000 test-results/qa --shots
//   AUDIT_PAGES=/,/shop/ node scripts/qa-mobile-audit.mjs ...   (comma separated; on Git Bash set MSYS_NO_PATHCONV=1)
//   AUDIT_ADMIN_EMAIL=... AUDIT_ADMIN_PASSWORD=... also signs in and audits every admin page (use a local or test
//   account, never the production owner).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3000';
const out = process.argv[3] ?? 'test-results/qa';
const shots = process.argv.includes('--shots');
fs.mkdirSync(out, { recursive: true });

const pages = process.env.AUDIT_PAGES ? process.env.AUDIT_PAGES.split(',') : [
  '/', '/shop/', '/sofas/', '/sofas/l-shape/', '/product/luxury-emerald-green-l-shape-sofa-modern-furniture-colombo/', '/cart/', '/book-visit/', '/visit/', '/about-us/', '/factory/', '/trade/',
  '/guides/', '/privacy/', '/admin/login/',
];
const adminLogin = process.env.AUDIT_ADMIN_EMAIL && process.env.AUDIT_ADMIN_PASSWORD;
const adminPages = [
  '/admin/', '/admin/bookings/', '/admin/bookings/calendar/', '/admin/customers/', '/admin/visitors/', '/admin/products/',
  '/admin/categories/', '/admin/invoices/', '/admin/settings/', '/admin/seo/', '/admin/chat/', '/admin/knowledge/',
];
const viewports = [
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'phone-360', width: 360, height: 740, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'laptop-1280', width: 1280, height: 800, mobile: false },
];

const browser = await chromium.launch();
const report = [];
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: vp.mobile ? devices['Pixel 7'].userAgent : undefined,
  });
  await context.addInitScript(() => { try { sessionStorage.setItem('sfo-pre', '1'); } catch { /* ignore */ } });
  if (adminLogin) {
    const loginPage = await context.newPage();
    await loginPage.goto(`${base}/admin/login/`, { waitUntil: 'load' });
    await loginPage.getByLabel('Email').fill(process.env.AUDIT_ADMIN_EMAIL);
    await loginPage.getByLabel('Password').fill(process.env.AUDIT_ADMIN_PASSWORD);
    await loginPage.getByRole('button', { name: 'Sign in' }).click();
    await loginPage.waitForURL(/\/admin\/?$/, { timeout: 15000 }).catch(() => {});
    await loginPage.close();
  }
  for (const p of adminLogin && !process.env.AUDIT_PAGES ? [...pages, ...adminPages] : pages) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 140)}`));
    const started = Date.now();
    let status = 0;
    try {
      const res = await page.goto(base + p, { waitUntil: 'load', timeout: 45000 });
      status = res?.status() ?? 0;
    } catch (e) { errors.push(`goto: ${String(e).slice(0, 100)}`); }
    const loadMs = Date.now() - started;
    await page.waitForTimeout(1200);
    // scroll through so lazy content and scroll-triggered animations run
    const height = await page.evaluate(async () => {
      const total = document.documentElement.scrollHeight;
      for (let y = 0; y < total; y += Math.round(innerHeight * 0.8)) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
      return document.documentElement.scrollHeight;
    });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const overflowing = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.visibility === 'hidden') continue;
        if (r.right > vw + 1 && !el.closest('[class*="rail"], [class*="marquee"], .overflow-x-auto, [data-scroller]')) {
          overflowing.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(r.right)}`);
          if (overflowing.length >= 4) break;
        }
      }
      const offscreen = [];
      for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('.sr-only, [aria-hidden=true], [inert]') || /skip to content/i.test(el.textContent || '')) continue;
        if (el.closest('[class*="overflow-x-auto"], [class*="snap-x"], [class*="rail"], [class*="marquee"], [data-scroller]')) continue;
        let fixedAncestor = false;
        for (let p = el; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).position === 'fixed') { fixedAncestor = true; break; } }
        if ((r.right > vw + 1 || r.left < -1) && r.top < 4000) offscreen.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}" ${Math.round(r.left)}..${Math.round(r.right)}${fixedAncestor ? ' (fixed)' : ''}`);
      }
      const small = [];
      let smallCount = 0;
      for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
        if (r.width < 40 || r.height < 40) {
          smallCount += 1;
          if (small.length < 5) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      const tinyText = [...document.querySelectorAll('p, li, span, a, label, td, dd, dt')]
        .filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3))
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && parseFloat(getComputedStyle(el).fontSize) < 12; }).length;
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).length;
      return {
        scrollW: document.documentElement.scrollWidth, vw, overflowing, smallCount, small, tinyText, broken, offscreen: offscreen.slice(0, 4),
        h1: document.querySelector('h1')?.textContent?.trim().slice(0, 50) ?? null,
        zeros: [...document.querySelectorAll('[data-count], [data-countup]')].map((e) => e.textContent.trim()).filter((t) => /^0\b/.test(t)).slice(0, 3),
      };
    });
    const row = { vp: vp.name, page: p, status, loadMs, height, ...m, errors: [...new Set(errors)].slice(0, 3) };
    report.push(row);
    // the parked page-curtain would paint a solid slice over a full-page screenshot
    await page.addStyleTag({ content: '.page-curtain,.grain{display:none!important}' }).catch(() => {});
    if (shots && (vp.name === 'phone-390' || (vp.name === 'laptop-1280' && ['/', '/shop/'].includes(p)))) {
      const file = path.join(out, `${vp.name}${p.replace(/\//g, '_')}.jpg`);
      await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 55, scale: 'css' }).catch(() => {});
    }
    await page.close();
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
for (const r of report) {
  const flags = [];
  if (r.status !== 200) flags.push(`HTTP ${r.status}`);
  if (r.scrollW > r.vw + 1) flags.push(`H-OVERFLOW ${r.scrollW}>${r.vw} ${r.overflowing[0] ?? ''}`);
  if (r.smallCount) flags.push(`tap<40px:${r.smallCount} [${r.small.slice(0, 2).join('; ')}]`);
  if (r.tinyText) flags.push(`text<12px:${r.tinyText}`);
  if (r.offscreen?.length) flags.push(`OFF-SCREEN controls: ${r.offscreen.join('; ')}`);
  if (r.broken) flags.push(`broken-img:${r.broken}`);
  if (r.errors.length) flags.push(`errors:${r.errors.join(' | ')}`);
  if (r.zeros.length) flags.push(`count-up stuck at: ${r.zeros.join(',')}`);
  console.log(`${r.vp.padEnd(12)} ${r.page.padEnd(16)} h=${String(r.height).padEnd(6)} load=${r.loadMs}ms ${flags.length ? '\n    ' + flags.join('\n    ') : 'ok'}`);
}
