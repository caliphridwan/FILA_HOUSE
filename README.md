# Fila House — Local Caps Marketplace

A full-stack e-commerce app for selling local caps (Atiku, Tangaran, Maroofiya, Bindo, and any
categories you add). Node.js/Express + PostgreSQL backend, Paystack for real payments, and a
plain HTML/CSS/JS frontend served by the same server.

## What's included

- **Shop:** browse by category, search, add to cart
- **Checkout:** delivery details → Paystack hosted checkout → receipt
- **Admin panel:** upload caps (with photo), manage categories, set delivery pricing per zone —
  protected by an admin key
- **Payments:** real Paystack integration (initialize transaction + webhook confirmation),
  with server-side price/stock validation so nothing can be tampered with from the browser

## 1. Prerequisites

- Node.js 18+
- A PostgreSQL database (local, or a free tier on Render / Railway / Supabase / Neon)
- A Paystack account — get your **test** secret & public keys from
  https://dashboard.paystack.com/#/settings/developer

## 2. Setup

```bash
cd fila-house
npm install
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgres://user:password@host:5432/dbname
ADMIN_API_KEY=pick-a-long-random-string
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxx
FRONTEND_URL=http://localhost:4000
```

Create the tables and seed starter caps/categories/zones:

```bash
npm run db:init
```

Start the server:

```bash
npm start
```

Visit **http://localhost:4000** — the shop loads immediately. Click **Admin** and enter the
`ADMIN_API_KEY` you set above to manage caps, categories, and delivery pricing.

## 3. Connecting Paystack for real payments

1. In the Paystack dashboard, go to **Settings → API Keys & Webhooks**.
2. Add a webhook URL pointing at your deployed server:
   `https://your-domain.com/api/paystack/webhook`
   (Paystack needs a public HTTPS URL — this won't work with `localhost` unless you tunnel it,
   e.g. with `ngrok http 4000`, and use the ngrok URL as your webhook + `FRONTEND_URL`.)
3. That's it — when a customer pays, Paystack calls the webhook, the server verifies the
   signature, marks the order paid, and deducts stock. The `GET /api/orders/verify/:reference`
   route is also called by the confirmation page as a fallback in case the webhook is delayed.
4. Use Paystack's test cards (listed in their docs) to try a full payment end to end before
   going live. When ready, swap in your live secret/public keys.

## 4. How the pieces fit together

- `public/index.html` — the shop + admin UI. Talks to the API with `fetch`.
- `public/order-confirmation.html` — where Paystack redirects the customer after payment;
  shows the final receipt.
- `src/routes/orders.js` — creates orders (recomputing all prices server-side), starts the
  Paystack transaction, and exposes the receipt/verify endpoints.
- `src/routes/paystackWebhook.js` — verifies Paystack's signature and confirms payment.
- `src/routes/caps.js`, `categories.js`, `zones.js` — admin-protected CRUD, backed by Postgres.
- `db/schema.sql` — table definitions + starter data.

## 5. Deploying

Any Node host works (Render, Railway, Fly.io, a VPS, etc.). Steps are the same as local setup:
set the environment variables, run `npm run db:init` once against your production database,
then `npm start` (or let your host run it). Point Paystack's webhook at your live URL, and set
`FRONTEND_URL` to that same URL so Paystack redirects back to the right place after payment.

## Notes

- Uploaded cap photos are stored in `/uploads` and served at `/uploads/<filename>`. On most
  hosts this is fine for a small catalog; for heavier use, swap in S3/Cloudinary later.
- The admin key is a simple shared secret for one operator. For multiple admin users with
  logins, you'd want to add a proper users table + authentication — happy to help with that
  if you need it.
