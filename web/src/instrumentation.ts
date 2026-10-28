// Runs once when a server process starts (not during `next build`). With the
// local PGlite database, open it here so migrations and the capture seed are
// finished before the first request. Neon is migrated by `npm run db:migrate`.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DATABASE_URL) return;
  try {
    const { getDb } = await import('./lib/db');
    const { seedKnowledge } = await import('./lib/seed/knowledge');
    const db = await getDb();
    await seedKnowledge(db);
  } catch (error) {
    console.error('[db] the local database could not be opened:', error);
  }
}
