import products from '../seed/capture/products.json';

const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const borrowed = /bebitalia|_project_|outdoor_complement/i;
const categoryUrls = ['sofa', 'beds', 'chair', 'table', 'ottoman', 'pillows', 'coffee'].map((slug) => `/product-category/${slug}/`);
const fixed = ['/', '/shop/', '/about-us/', '/cart/', '/checkout/', '/my-account/', '/?p=265', '/?p=267'];
type Result = { url: string; expected: string; result: string; ok: boolean };

async function check(path: string, hidden = false): Promise<Result> {
  try {
    const first = await fetch(`${base}${path}`, { redirect: 'manual' });
    const location = first.headers.get('location');
    if (first.status === 301 && location) {
      const second = await fetch(new URL(location, base), { redirect: 'manual' });
      return { url: path, expected: hidden ? '301 → 200' : '200 or 301 → 200', result: `301 → ${second.status}`, ok: second.status === 200 };
    }
    return { url: path, expected: hidden ? '301 → 200' : '200 or 301 → 200', result: String(first.status), ok: !hidden && first.status === 200 };
  } catch (error) {
    return { url: path, expected: hidden ? '301 → 200' : '200 or 301 → 200', result: error instanceof Error ? error.message : 'request failed', ok: false };
  }
}

const productChecks = products.map((product) => ({ path: `/product/${product.slug}/`, hidden: product.images.some((image) => borrowed.test(image.src)) }));
const results = await Promise.all([...productChecks, ...categoryUrls.map((path) => ({ path, hidden: false })), ...fixed.map((path) => ({ path, hidden: false }))].map(({ path, hidden }) => check(path, hidden)));
console.table(results);
if (results.some((result) => !result.ok)) process.exitCode = 1;
