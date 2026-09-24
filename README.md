# Easypick website

Next.js 16 (App Router) + Tailwind v4. Public site for Easypick: drops, shop, product pages with live stock, bag, checkout, store info and policies.

## Run

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

Without `STORE_API_URL`, the site serves the sample catalogue in `src/lib/mock-data.ts`.

## Where things live

| Path | What |
| --- | --- |
| `src/lib/store.ts` | All catalogue reads. Swaps from mock data to the Store API when `STORE_API_URL` is set. |
| `src/lib/types.ts` | Product, variant, drop and stock shapes the API must return. |
| `src/lib/site.ts` | Store address, hours, contacts, company details, delivery fees (several TODOs). |
| `src/app/actions.ts` | Server actions: drop-alert sign-up, place order (re-prices and re-checks stock on the server). |
| `src/app/api/stock/[slug]` | Live stock by size, polled every 30s by product pages. |
| `src/app/api/revalidate` | Webhook for the Store API to refresh pages after a product or drop changes. |

## Not wired up yet (needs the Store API)

- Payments: checkout creates an order in memory and shows a test-mode notice. Real flow: API creates order + payment, provider verifies server-to-server, only then "paid".
- Phone OTP sign-in and the account page.
- Saving drop-alert sign-ups (currently logged in dev only).
- Real product photos (placeholders are drawn from the product colour until `images[].src` is set).
