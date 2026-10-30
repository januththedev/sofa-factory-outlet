// Runs first in the Vercel build (vercel.json). Without these variables the app falls back to the
// embedded database and the local image folder, which do not work on Vercel, or refuses every
// admin sign-in (no AUTH_SECRET). Stop the deploy instead, with a
// list of what is missing. Does nothing outside Vercel, so local builds and the e2e server are unaffected.
if (process.env.VERCEL !== '1') process.exit(0);

const problems = [];
const need = (name, why) => {
  if (!process.env[name]?.trim()) problems.push(`${name}: ${why}`);
};

need('DATABASE_URL', 'Neon pooled connection string');
need('DATABASE_URL_UNPOOLED', 'Neon direct connection, used by db:migrate');
need('BLOB_READ_WRITE_TOKEN', 'Vercel Blob store for product photos');
if ((process.env.BLOB_ACCESS ?? '').trim() !== 'private') problems.push('BLOB_ACCESS: must be "private" (the Blob store is private; photos and uploads break otherwise)');
const placeholder = (value) => /^replace/i.test(value.trim());
const cron = process.env.CRON_SECRET ?? '';
if (cron.trim().length < 16 || placeholder(cron)) problems.push('CRON_SECRET: a random value of 16+ characters (the daily jobs are refused otherwise)');
const auth = process.env.AUTH_SECRET ?? '';
if (auth.trim().length < 32 || placeholder(auth)) problems.push('AUTH_SECRET: a random value of 32+ characters (openssl rand -base64 32)');
const ownerPassword = process.env.OWNER_PASSWORD ?? '';
if (ownerPassword && (ownerPassword.length < 10 || placeholder(ownerPassword))) {
  problems.push('OWNER_PASSWORD: still the example value or under 10 characters (or remove it once the owner account exists)');
}
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
if (!siteUrl.startsWith('https://')) {
  problems.push('NEXT_PUBLIC_SITE_URL: the https address of the site, e.g. https://sofafactoryoutlet.lk');
}

if (problems.length) {
  console.error(`\nThis deployment is missing required settings (see web/docs/DEPLOY.md, section 3):\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}
console.log('Production environment: all required variables are set.');
