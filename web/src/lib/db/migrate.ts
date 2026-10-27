import path from 'node:path';
import type { Db } from './index';

export const migrationsFolder = () => path.join(/* turbopackIgnore: true */ process.cwd(), 'drizzle');

export async function runMigrations(db: Db, mode: 'pglite' | 'neon'): Promise<void> {
  if (mode === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: migrationsFolder() });
    return;
  }
  const { migrate } = await import('drizzle-orm/neon-serverless/migrator');
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: migrationsFolder() });
}
