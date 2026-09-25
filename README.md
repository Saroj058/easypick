# Easypick website

Next.js 16 (App Router) + Tailwind v4 + PostgreSQL. Public site for Easypick (drops, shop, live stock, bag, checkout, gifting, gift cards, accounts) and the staff admin at `/admin`.

## Run

```bash
npm install
cp .env.example .env.local   # then fill in what you need
npm run dev                  # http://localhost:3000
```

`npm run dev` also starts a local PostgreSQL (from the `embedded-postgres` package, nothing else to install), stored in `.data/postgres` on `127.0.0.1:5433`. Stop the site with Ctrl+C so the database shuts down cleanly.

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
| `src/app/admin` | Staff screen; login with `ADMIN_USERNAME` / `ADMIN_PASSWORD`. |

## Not wired up yet

- Payments: orders show a test-mode "Pay now" until eSewa / Khalti / Fonepay merchant accounts exist. Only a server-to-server confirmation may mark an order paid.
- SMS gateway for order texts and login codes (codes show on screen in development).
- Hosting, domain, and image storage for product photos uploaded in the admin.
