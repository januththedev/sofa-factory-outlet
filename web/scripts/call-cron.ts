// Calls a protected job route on a running app, so scripts never open the
// local database themselves:  npm run cron -- rollup   |   npm run eval:chat
import './_env';

async function main() {
  const job = process.argv[2];
  if (!job) {
    console.error('Usage: npm run cron -- <job>   (rollup, digest, search-console, eval-chat)');
    process.exit(1);
  }
  const base = (process.env.CRON_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const response = await fetch(`${base}/api/cron/${job}/`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
  });
  const text = await response.text();
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
