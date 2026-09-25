# Easypick website

Next.js 16 (App Router) + Tailwind v4 + PostgreSQL. Public site for Easypick (drops, shop, live stock, bag, checkout, gifting, gift cards, accounts) and the staff admin at `/admin`.

## Run

```bash
npm install
cp .env.example .env.local   # then fill in what you need
npm run dev                  # http://localhost:3000
```

`npm run dev` uses `DATABASE_URL` from `.env.local` when it's set. Without it, or with `npm run dev:offline`, it starts a local PostgreSQL (from the `embedded-postgres` package, nothing else to install), stored in `.data/postgres` on `127.0.0.1:5433` (database `easypick`, UTF-8). Stop the site with Ctrl+C so the database shuts down cleanly.

## Tests

| Command | What |
| --- | --- |
| `npm test` | Unit tests and database tests (stock holds, the last piece sold once, payment counted once, late payments, eSewa signatures). Starts its own throwaway PostgreSQL. |
| `npm run test:e2e` | Browser tests (shop, Buy now, login, tracking, admin). Runs a second dev server on port 3100 with its own database in `.data/postgres-e2e`. First time: `npx playwright install chromium`. |

GitHub Actions runs lint, types, both test suites and a production build on every push (`.github/workflows/ci.yml`).

## Database

| Command | What |
| --- | --- |
| `npm run db:generate` | After changing `src/lib/db/schema.ts`: writes a new migration into `/drizzle`. |
| `npm run db:migrate` | Applies migrations to `DATABASE_URL` (the live database). Locally they run on start. |
| `npm run db:studio` | Browse the data in Drizzle Studio (set `DATABASE_URL` first). |

For the live site set `DATABASE_URL` to a hosted PostgreSQL (e.g. Supabase, Mumbai region). Tables are created on first start unless `DB_AUTO_MIGRATE=false`, and an empty database starts with the sample catalogue. To use the local database again, comment out `DATABASE_URL` in `.env.local`.

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
2. **Migrations.** Set `DB_AUTO_MIGRATE=false` on Vercel and run `npm run db:migrate` against the live database before each deploy that adds a file to `/drizzle`. Several servers starting at once shouldn't all migrate.
3. **Secrets.** Set `SESSION_SECRET`, `CRON_SECRET`, `ADMIN_USERNAME` / `ADMIN_PASSWORD` (first login only), `SUPABASE_URL` / `SUPABASE_SECRET_KEY` (photos), email and SMS keys, and `NEXT_PUBLIC_SITE_URL` (the real domain). Copy from `.env.example`.
4. **Payments.** Leave `PAYMENTS_MODE=test` for a trial run. For real money set `PAYMENTS_MODE=live`, `ESEWA_PRODUCT_CODE` and `ESEWA_SECRET_KEY` from the eSewa merchant account.
5. **Cron.** `vercel.json` calls `/api/cron` every 5 minutes. The Hobby plan only allows one run a day; on Hobby, use a free external pinger (e.g. cron-job.org) sending `Authorization: Bearer <CRON_SECRET>` every 5 minutes instead. The order page also checks eSewa itself when a customer opens it, so this is a safety net, not the only path.
6. **Analytics.** Turn on Web Analytics in the Vercel project. It's cookie-free and skips private pages (gift links, orders, admin).
7. **After the first deploy.** Sign in at `/admin`, change the password in Account, and add each helper under Staff with their own login.

## Not wired up yet

- eSewa live merchant account (the sandbox works now). Khalti and Fonepay are built but switched off in `site.payments.enabled`.
- SMS gateway for order texts and login codes (codes show on screen in development).
- Domain, store address, phone and PAN/VAT in `src/lib/site.ts`.
