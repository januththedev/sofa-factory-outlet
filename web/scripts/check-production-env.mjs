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
need('CRON_SECRET', 'the daily jobs are refused without it');
if ((process.env.AUTH_SECRET ?? '').length < 32) problems.push('AUTH_SECRET: at least 32 characters (openssl rand -base64 32)');
if (!(process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://')) {
  problems.push('NEXT_PUBLIC_SITE_URL: the https address of the site, e.g. https://sofafactoryoutlet.lk');
}

if (problems.length) {
  console.error(`\nThis deployment is missing required settings (see web/docs/DEPLOY.md, section 3):\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}
console.log('Production environment: all required variables are set.');
