# Green-Cart (Final Year Project)

Full‑stack e‑commerce app with user + seller panels, cart, address management, orders (COD + Stripe), and Cloudinary product images.

## Tech
- Client: React + Vite + Tailwind
- Server: Node (Express) + MongoDB (Mongoose) + Stripe + Cloudinary

## Quick Start (Local)
Prereqs: Node.js (LTS), MongoDB connection string, Stripe account, Cloudinary account.

### 1) Server
```bash
cd server
copy .env.example .env
```
Fill `server/.env`:
- `MONGODB_URI`, `JWT_SECRET`
- `CLOUDINARY_*`
- `STRIPE_SECRET_KEY` (required for payments)
- `STRIPE_WEBHOOK_SECRET` (recommended; optional if you use redirect verification)
- `FRONTEND_URL=http://localhost:5173`

Run:
```bash
npm install
npm run dev
```
If PowerShell blocks `npm`, use `npm.cmd` instead (e.g. `npm.cmd run dev`).

### 2) Client
```bash
cd client
copy .env.example .env
npm install
npm run dev
```
If PowerShell blocks `npm`, use `npm.cmd` instead (e.g. `npm.cmd run dev`).
Open `http://localhost:5173`.

## Stripe (Orders showing in “My Orders”)
This project supports **both**:

1) **Webhooks (recommended)**  
Forward webhooks to your local server:
```bash
stripe listen --forward-to localhost:3000/stripe
```
Copy the printed webhook secret into `server/.env` as `STRIPE_WEBHOOK_SECRET`.

2) **Redirect verification (works even without webhooks)**  
After Stripe checkout success, the app redirects to `/loader?...&session_id=...` and the client calls `GET /api/order/stripe/verify` to mark the order as paid.

## Deployment notes
- `client/` and `server/` each include `vercel.json`.
- Set the same environment variables from `server/.env.example` in your hosting provider.
