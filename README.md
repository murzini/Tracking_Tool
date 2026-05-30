# AdventureBag - Shop app

This repo contains the standalone **Shop** application:
- Renders Landing, Search, Details, Checkout, and Thank You prototype flows.
- Consumes Shop CMS configuration from Coach via `COACH_BASE_URL`.
- Supports Student tour mode via query parameters (`tour`, `step`, `sku`).
- Owns local fallback API routes for `landing`, `search`, and `details` config.

## Documentation

Detailed docs live in `Documentation/` (plus `onboarding.md` at the repo root for session-to-session context):

- `PRODUCT_OVERVIEW.md` — product vision, milestone scope, working rules, tech-debt register.
- `ARCHITECTURE_OVERVIEW.md` — system architecture, data flow, file boundaries.
- `DATA.md` — Postgres schema (`sessions` + `events`) and field definitions.
- `TEST_CASES.md` — full per-test specifications and the authoritative test count.
- `AGENTS.md` — working rules and the agent catalogue.
- `FUTURE_THIRD_PARTY_INTEGRATION.md` — integration seams for embedding into a host product.
- `SCALE_DESIGN.md` — batching / ingestion / sampling design for host-scale traffic.

## Run locally
```bash
npm install
npm run dev
```

## Environment
- `SHOP_ENABLE_COACH_PROXY=1` enables runtime Coach config probing.
- `COACH_BASE_URL` must point to the Coach base domain (without trailing slash) when Coach proxying is enabled.
- `DATABASE_URL` — Neon (Postgres) pooled connection string for the heatmap store. Required for capture, the heatmap viewer, and the query/cleanup APIs. Lives in `.env.local` (gitignored); see `.env.example` for the format. Never commit the real value.
- `HEATMAP_DB_SCHEMA` — Postgres schema the store reads/writes (default `public`). The isolated test runner sets it to `heatmap_test` so the suite never touches production data.
- `NEXT_PUBLIC_HEATMAP_SAMPLING_RATE` — per-session capture sampling rate, `0`–`1` (default `1` = 100%). Now a seed/fallback only — runtime config (dashboard) takes precedence; a `heatmapSampleRate` query param overrides for tests and manual checks. Sampling is applied per session (one step visit); 0%/100% are deterministic.
- `DASHBOARD_TOKEN` — shared secret that gates the admin dashboard and auth-gated API routes (`POST /api/checkout-heatmap/config`, `DELETE /api/checkout-heatmap`, `POST /api/checkout-heatmap/report`, `POST /api/checkout-heatmap/screenshots`). Set to any non-empty string; pass it as the `token=` query param when opening `/dashboard`. Lives in `.env.local` (gitignored). Never commit the real value.
- `ANTHROPIC_API_KEY` — Anthropic API key required for report generation (`POST /api/checkout-heatmap/report`). Lives in `.env.local` (gitignored). Never commit the real value.

## Config API behavior
- `GET /api/landing-config`
- `GET /api/search-config`
- `GET /api/details-config`
- By default, Shop returns local fallback JSON immediately for fast local development.
- If `SHOP_ENABLE_COACH_PROXY=1`, Shop tries Coach endpoints first and falls back locally if Coach is unavailable.

## Heatmap

All three checkout steps (`personal-info`, `delivery`, `pay`) record visitor behaviour — clicks, mouse/finger movement, and scroll depth — and visualise it as selectable overlays: click dots (opacity-by-count), mouse-move trails, and scroll colour-by-depth (chosen via the `type` URL param on the heatmap page).

- Open the **admin dashboard** at `/dashboard?token=<DASHBOARD_TOKEN>` — use the **Heatmap** section to select a step, view, and type, then click **Open heatmap** to open that step's heatmap in a new tab; use the **Data** section to clear all captured data.
- Append `?m1HeatmapTest=1` to the checkout URL to activate the 2-second inactivity threshold for automated testing (default is 30 seconds).
- The heatmap view is available at `/checkout/[sku]/heatmap?step=<step>&view=desktop_view` (or `?view=mobile_view`), where `<step>` is `personal-info` (default), `delivery`, or `pay`.

### Admin dashboard
- `/dashboard?token=<DASHBOARD_TOKEN>` — single-page admin UI (Data / Heatmap / Simulation / Report sections). Secret-link auth via `DASHBOARD_TOKEN`. The Simulation section generates ~1500 synthetic sessions into a separate schema so you can preview the visualisations at volume without real traffic.

### Heatmap API routes
- `GET /api/checkout-heatmap` — read all stored sessions
- `POST /api/checkout-heatmap` — append a finalised session (legacy; kept for back-compat, no longer called by the client since M4 Part 2)
- `DELETE /api/checkout-heatmap` — clear all stored sessions (auth-gated; requires `Authorization: Bearer <DASHBOARD_TOKEN>`)
- `POST /api/checkout-heatmap/ingest` — batched ingestion; body `{ session, events[] }`. The capture client streams events here (interval/size flush + `sendBeacon` on unload) instead of a finalize-only POST
- `GET /api/checkout-heatmap/config` — read the active capture config (steps, event types, sampling rate, capture window, inactivity threshold). Public; the capture client calls this on every visit
- `POST /api/checkout-heatmap/config` — upsert capture config (dashboard Save). Auth-gated; requires `Authorization: Bearer <DASHBOARD_TOKEN>`
- `GET /api/checkout-heatmap/query?step=&view=&from=&to=` — read-only query, filtered by step / view / timeframe
- `POST /api/checkout-heatmap/cleanup` — TTL/archival cleanup; body `{ before }` (ISO cutoff) or `{ ttlDays }` (default 30)
- `POST /api/checkout-heatmap/sweep` — lazy/derived finalize; marks stale unfinalized sessions `abandoned` after the grace window; body `{ now?, force? }` (tests/manual checks pass `force: true` to skip the age check)
- `GET /api/checkout-heatmap/simulate` — count of simulated sessions in the sim schema (no auth required)
- `POST /api/checkout-heatmap/simulate` — generate ~1500 synthetic sessions into the sim schema (auth-gated)
- `DELETE /api/checkout-heatmap/simulate` — discard all simulated sessions (auth-gated)
- `POST /api/checkout-heatmap/report` — generate AI report from captured sessions (auth-gated; calls Claude Sonnet; `?source=real|sim|demo` selects which schema to read; returns 4-section JSON report + aggregated data)
- `POST /api/checkout-heatmap/screenshots` — capture heatmap screenshots via headless Playwright (auth-gated; body `{ source?, sku?, steps? }`; returns base64 screenshots for the report page)
- `GET /api/db-status` — DB connectivity / schema inspection

## Running tests

Tests require `localhost:3000` to be running first (`npm run dev`), then:

```bash
npx playwright test
```

On Windows, run the isolated suite (starts its own dev server on a clean port 3000, then runs Playwright):
```bash
npm run test:e2e
```

`npx playwright test` (or `npm run test:e2e`) runs the **whole** suite — every spec file under `tests/e2e/`, backed by the Neon Postgres store. For the authoritative test count and the test-number → behaviour → spec-file mapping, see `Documentation/TEST_CASES.md`. This README intentionally does not hardcode a count or file list (they drift).

## Deploy to Vercel
- Framework: Next.js
- Node: 20.x
- Root Directory: repo root
