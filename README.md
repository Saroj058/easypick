# Easypick website

Next.js 16 (App Router) + Tailwind v4 + PostgreSQL. Public site for Easypick (drops, shop, live stock, bag, checkout, gifting, gift cards, accounts) and the staff admin at `/admin`.

## Run

```bash
npm install
cp .env.example .env.local   # then fill in what you need
npm run dev                  # http://localhost:3000
```

`npm run dev` uses `DATABASE_URL` from `.env.local` when it's set. Without it, or with `npm run dev:offline`, it starts a local PostgreSQL (from the `embedded-postgres` package, nothing else to install), stored in `.data/postgres` on `127.0.0.1:5433` (database `easypick`, UTF-8). Stop the site with Ctrl+C so the database shuts down cleanly.

When `DATABASE_URL` points at a hosted database (the live Supabase one), `npm run dev` prints **Using the LIVE database (host)** and leaves it alone: no migrations on start, no sample catalogue. Orders, stock and accounts you touch are real. Apply new migrations to it on purpose with `npm run db:migrate`.

## Tests

| Command | What |
| --- | --- |
| `npm test` | Unit tests and database tests (stock holds, the last piece sold once, payment counted once, late payments, eSewa signatures). Starts its own throwaway PostgreSQL. |
| `npm run test:e2e` | Browser tests (shop, Buy now, login, tracking, admin). Runs a second dev server on port 3100 with its own database in `.data/postgres-e2e`. First time: `npx playwright install chromium`. Each run uses fresh random phone numbers; to start from an empty database, stop the tests and delete `.data/postgres-e2e`. |

GitHub Actions runs lint, types, both test suites and a production build on every push (`.github/workflows/ci.yml`).

## Database

| Command | What |
| --- | --- |
| `npm run db:generate` | After changing `src/lib/db/schema.ts`: writes a new migration into `/drizzle`. |
| `npm run db:migrate` | Applies migrations to `DATABASE_URL` (the live database). Takes a lock, so two runs at once wait for each other; on Supabase it switches the transaction pooler (6543) to the session pooler (5432) for this. A local database is migrated on start. |
| `npm run db:studio` | Browse the data in Drizzle Studio (set `DATABASE_URL` first). |

For the live site set `DATABASE_URL` to a hosted PostgreSQL (e.g. Supabase, Mumbai region). Servers never migrate or seed it by themselves: run `npm run db:migrate`. (`DB_AUTO_MIGRATE=true` forces migrations on start; `SEED_SAMPLE=1` fills an empty production database with the sample catalogue. Both are off by default.) An empty local database starts with the sample catalogue. To use the local database again, comment out `DATABASE_URL` in `.env.local`, or use `npm run dev:offline`.

Each server keeps up to 5 database connections (`DB_POOL_MAX` changes it; lower it if Supabase's pooler reports too many clients).

## Where things live

| Path | What |
| --- | --- |
| `src/lib/db/schema.ts` | Tables: users, sessions, codes, products, variants (stock), drops, orders, gift cards, restock alerts, festivals. |
| `src/lib/db/index.ts` | Connection, migrations, first-run import. |
| `src/lib/catalogue.ts` | Products and stock changes (admin, paid orders, restock alerts). |
| `src/lib/store.ts` | Catalogue reads for the website. Swaps to the Store API when `STORE_API_URL` is set. |
| `src/lib/orders.ts`, `gift-cards.ts`, `auth.ts` | Orders, gift cards, accounts and sessions. |
| `src/lib/site.ts` | Store address, hours, contacts, company details, delivery fees (several TODOs). |
| `src/lib/reconcile.ts` | Late payment checks and data clean-up, run by `/api/cron`. |
| `src/lib/staff.ts` | Staff logins, roles (owner / helper) and the activity log. |
| `src/app/admin` | Staff screen: orders, refunds, exchanges, stock, drops, reports. The first login comes from `ADMIN_USERNAME` / `ADMIN_PASSWORD`. |

## Going live (Vercel + Supabase)

1. **Database.** Create the Supabase project in Mumbai (`ap-south-1`). On Vercel, set `DATABASE_URL` to the *Transaction pooler* string (port 6543, user `postgres.<project-ref>`).
2. **Migrations.** Leave `DB_AUTO_MIGRATE` unset on Vercel (servers don't migrate in production). Run `npm run db:migrate` against the live database **before** each deploy that adds a file to `/drizzle`.
3. **Secrets.** Set `SESSION_SECRET`, `CRON_SECRET`, `ADMIN_USERNAME` / `ADMIN_PASSWORD` (first login only), `SUPABASE_URL` / `SUPABASE_SECRET_KEY` (photos), email and SMS keys, and `NEXT_PUBLIC_SITE_URL` (the real domain, `https://`). Copy from `.env.example`. A production server won't start without `NEXT_PUBLIC_SITE_URL`, `SESSION_SECRET` (32+ chars) and `DATABASE_URL`, and logs `[config]` errors for anything else missing (check the Vercel logs after deploying).
   - Scope `SUPABASE_SECRET_KEY` (and the live `DATABASE_URL`, eSewa keys) to **Production** only. Give **Preview** deployments a separate database (or none): a preview build and its servers otherwise read and write the live shop. Previews without `NEXT_PUBLIC_SITE_URL` use their own `*.vercel.app` address.
   - Optional: `ESEWA_FORM_URL` / `ESEWA_STATUS_URL` override eSewa's addresses.
   - **Photos:** create a **public** Storage bucket named `products` in Supabase before uploading photos.
   - **Errors:** server errors are logged as JSON (`"event":"request_error"`) and emailed to `STAFF_ALERT_EMAIL` at most once every 10 minutes.
4. **Payments.** Leave `PAYMENTS_MODE=test` for a trial run. For real money set `PAYMENTS_MODE=live`, `ESEWA_PRODUCT_CODE` and `ESEWA_SECRET_KEY` from the eSewa merchant account.
5. **Cron.** `CRON_SECRET` is required (without it `/api/cron` refuses to run). `vercel.json` calls `/api/cron` every 5 minutes. The Hobby plan only allows one run a day; on Hobby, use a free external pinger (e.g. cron-job.org) sending `Authorization: Bearer <CRON_SECRET>` every 5 minutes instead. The order page also checks eSewa itself when a customer opens it, so this is a safety net, not the only path.
6. **Analytics.** Turn on Web Analytics in the Vercel project. It's cookie-free and skips private pages (gift links, orders, admin).
7. **After the first deploy.** Sign in at `/admin`, change the password in Account, and add each helper under Staff with their own login.

## Not wired up yet

- eSewa live merchant account (the sandbox works now). Khalti and Fonepay are built but switched off in `site.payments.enabled`.
- SMS gateway for order texts and login codes (codes show on screen in development).
- Domain, store address, phone and PAN/VAT in `src/lib/site.ts`.
