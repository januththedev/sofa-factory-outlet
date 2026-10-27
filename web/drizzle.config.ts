import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` only reads the schema; it never connects.
// PGlite applies migrations inside the app (src/lib/db/migrate.ts);
// Neon uses `npm run db:migrate` with DATABASE_URL_UNPOOLED.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || 'postgres://unused@localhost/unused',
  },
  strict: true,
  verbose: true,
});
