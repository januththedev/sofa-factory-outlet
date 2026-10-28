import { z } from 'zod';

// Shared by the Next server, CLI scripts and tests, so it must not import
// `server-only` (that package throws outside React Server Components).

const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());
const withDefault = (fallback: string) => z.preprocess((v) => (v === '' || v == null ? fallback : v), z.string());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: optional,
  DATABASE_URL_UNPOOLED: optional,
  PGLITE_DIR: withDefault('.data/pglite'),

  BLOB_READ_WRITE_TOKEN: optional,
  BLOB_ACCESS: z.enum(['public', 'private']).default('public'),
  BLOB_BASE_URL: optional,
  LOCAL_BLOB_DIR: withDefault('.data/blob'),

  AUTH_SECRET: optional,
  OWNER_EMAIL: optional,
  OWNER_PASSWORD: optional,
  OWNER_NAME: withDefault('Owner'),

  OPENROUTER_API_KEY: optional,
  OPENROUTER_CHAT_MODELS: withDefault(
    'google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3.5-lightning:free',
  ),
  OPENROUTER_EMBED_MODEL: optional,

  RESEND_API_KEY: optional,
  ADMIN_ALERT_EMAIL: optional,
  EMAIL_FROM: withDefault('Sofa Factory Outlet <bookings@sofafactoryoutlet.lk>'),

  CRON_SECRET: optional,
  NEXT_PUBLIC_SITE_URL: withDefault('http://localhost:3000'),

  INDEXNOW_KEY: optional,
  GSC_SERVICE_ACCOUNT_JSON: optional,
  GSC_SITE_URL: optional,
});

export const env = schema.parse(process.env);
export type Env = typeof env;

export const isPglite = () => !env.DATABASE_URL;
export const hasBlob = () => Boolean(env.BLOB_READ_WRITE_TOKEN);
export const hasOpenRouter = () => Boolean(env.OPENROUTER_API_KEY);
export const hasEmail = () => Boolean(env.RESEND_API_KEY && env.ADMIN_ALERT_EMAIL);
export const siteUrl = () => env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
export const chatModels = () =>
  env.OPENROUTER_CHAT_MODELS.split(',')
    .map((m) => m.trim())
    .filter(Boolean);
