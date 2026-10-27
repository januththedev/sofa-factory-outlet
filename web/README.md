# Sofa Factory Outlet (web)

The Next.js 16 app described in `../Plan.md`: landing page, store, cart that books a showroom visit, chatbot, admin, invoices and SEO.

- **Progress, commands and open questions:** [`BUILD-STATUS.md`](BUILD-STATUS.md)
- **Spec:** [`../Plan.md`](../Plan.md). The old WordPress capture is in `../data`, `../pages` and `../assets`.

## Quick start

```powershell
cd web
copy .env.example .env.local     # then set AUTH_SECRET, CRON_SECRET and the owner password
npm install
npm run media:import             # needs the originals in ../assets/uploads (see ../download-images.ps1)
npm run dev
```

With no `DATABASE_URL`, the app runs on an embedded Postgres (PGlite) stored in `.data/pglite`. It migrates and seeds itself from the site capture on first start. With no `BLOB_READ_WRITE_TOKEN`, product photos live in `.data/blob` and are served from `/blob/`.

## Going live

Moving to Neon, Vercel Blob, OpenRouter, Resend and Search Console needs environment variables only (see `.env.example`). The launch checklist is in `docs/DEPLOY.md` (written in Phase 9).
