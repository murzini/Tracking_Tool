# Session Onboarding

Quick start for a new session. **Review and trim this file at the start of every session — rewrite it to the current state, don't pile new notes on top.** Keep only what the next session needs to act. Detail lives in the docs; this file points to them.

**Only "Current state" and "Next action" change each session — replace them. Everything else is stable structure; keep it.**

## What this project is

A heatmap product on a Next.js sandbox (Shop). It records visitor behaviour on the three checkout steps and shows it as overlays, to learn why people drop off. A POC, meant for later integration into Autohero.

**GitHub:** `https://github.com/murzini/Tracking_Tool` (main branch — source of truth)
**Vercel:** `https://tracking-tool-kappa.vercel.app` (auto-deploys on push to main)
**Workflow:** Clone once to `C:\Temp\Tracking_Tool` and keep it for the duration of M7. At the start of each part, run `git pull` to ensure the clone is current — do not rely on `git status` alone (it won't show remote changes without a fetch). Delete the folder only when M7 is fully closed. If the folder is missing, clone fresh from GitHub.

## Model selection

At the start of each task, I assess whether the current model tier is the best fit (see `.claude/agents/model-selector.md` for the 3-tier mapping: Opus = hard reasoning/architecture; Sonnet = everyday coding/agents; Haiku = mechanical tasks). 

**Behavior:** I emit a one-line verdict before proceeding to work:
- If the current model fits: `Model: <tier> OK — <reason>`
- If it doesn't fit: `Suggest /model <tier> — <reason>`

**Important:** I never shift the model implicitly (e.g., via subagent override or workaround). You control all transitions — you decide whether to switch the main session model. I prompt, you switch, I proceed.

**Enforcement hooks:** a `UserPromptSubmit` hook in `.claude/settings.json` injects the model-fit reminder on every prompt automatically. This is a safety net — the proactive one-line verdict is still required before any work.

See `CLAUDE.md` → "Model selection" for the full rule.

## Current state

- **M1–M7 CLOSED and signed off.** GitHub + Vercel live (`tracking-tool-kappa.vercel.app`, auto-deploys on push to `main`). Commit `2dc0b3a` is the M7 restore point.
- **Unit tests 273/273 green; E2e suite 80/80 green (confirmed 2026-05-30).**
- **Report pipeline works end-to-end on Vercel Hobby** — text + charts render correctly. Tested with `source=demo` (22 frozen sessions). Report takes ~80s.
- **Screenshots fixed (post-M7 hotfix, 2026-05-31)** — Playwright replaced with ScreenshotOne API (Edge runtime). Code committed, not yet pushed. Requires `SCREENSHOTONE_ACCESS_KEY` in Vercel env vars before screenshots will appear live.

### Report pipeline architecture (post-M7 hotfix, 2026-05-30)

The report route was split into two to work around Vercel Hobby's 10s serverless timeout:

1. **`POST /api/checkout-heatmap/report`** — Node runtime. DB read + aggregation transforms only. Returns `{ ok, aggregatedData, stepsWithData }`. Fast (~3s).
2. **`POST /api/checkout-heatmap/report/generate`** — Edge runtime. Receives `aggregatedData` from the client, calls Claude via raw `fetch` + SSE streaming (no SDK — SDK pulls Node-only modules into Edge bundle). Returns `{ ok, report }`. Takes ~20–40s; streaming keep-alives prevent Vercel from dropping the connection.
3. **`POST /api/checkout-heatmap/screenshots`** — Edge runtime. ScreenshotOne external API (`https://api.screenshotone.com/take`). Captures all pages in parallel (`Promise.allSettled`). Auth via `dashboardAuth.edge.js`. Requires `SCREENSHOTONE_ACCESS_KEY` env var. `SCREENSHOT_PUBLIC_BASE_URL` needed locally (auto-resolves from `VERCEL_URL` on Vercel).
4. **`lib/prototype/dashboardAuth.edge.js`** — Edge-safe auth twin (pure JS, no `crypto`/`Buffer`). Used by the generate route. The original `dashboardAuth.js` (Node only) stays in place for all other routes.

### Key files changed in hotfix (committed, not yet pushed)
- `app/api/checkout-heatmap/report/route.js` — data-only, Node runtime
- `app/api/checkout-heatmap/report/generate/route.js` — Claude call, Edge runtime (NEW)
- `lib/prototype/dashboardAuth.edge.js` — Edge-safe auth (NEW)
- `app/dashboard/report/ReportClientPage.jsx` — chains two requests sequentially
- `app/api/checkout-heatmap/screenshots/route.js` — Playwright replaced with ScreenshotOne, Edge runtime (post-M7 hotfix 2026-05-31)

### Unchanged context
- **`.env.local`** holds `ANTHROPIC_API_KEY`, Neon `DATABASE_URL`, `DASHBOARD_TOKEN=dashboard-link` (local only — never commit).
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` — INTENDED. See `DATA.md` → `exit_reason`.
- **Gotcha — suite startup:** If tests time out from Test 1, a stale dev server is holding port 3000. Fix: kill all node/npm processes → delete `.next` → re-run isolated runner. Do NOT run two dev servers at once.

## Next action

**Deploy screenshot fix — code is ready and tests are green. Not yet pushed.**

1. Add `SCREENSHOTONE_ACCESS_KEY` to Vercel env vars (Dashboard → Settings → Environment Variables). Get the key from your ScreenshotOne account. Never commit it.
2. Optionally add `SCREENSHOT_PUBLIC_BASE_URL` if Vercel URL auto-detection is unreliable.
3. Push `main` — Vercel auto-deploys.
4. Test: open `/dashboard/report?token=dashboard-link&source=demo` — confirm screenshots appear for all step/type combos (personal-info × clicks/moves/scrolls).
5. If images are missing: check Vercel function logs for the screenshots route (likely missing API key or ScreenshotOne error).
6. Once confirmed: update "Current state" to mark screenshots live, clear this section.

## What to read first, in order

1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` → **M7** — frozen scope, 10-part plan, unit-testability principle, anticipated tech debt. Also "M7 unit-test surface" for the pure-module map.
3. `Documentation/TEST_CASES.md` → **M7** — Tests 64-69 (e2e; Test 63 also updated) + M7.1/M7.2/M7.3 unit specs + new M7 code unit specs (`reportGateLogic`, `reportAggregationTransforms`, `reportPromptBuilder`, `reportResponseParser`).
4. `Documentation/ARCHITECTURE_OVERVIEW.md` → **M7 architecture — AI report pipeline** — request flow, data-only-Claude decision, parallel screenshots, pure-module map.

**Reference — read as needed:**
5. `Documentation/DATA.md` — Postgres schema (`sessions` + `events`); `exit_reason` semantics.
6. `Documentation/SCALE_DESIGN.md` — batching / ingestion / sampling blueprint (§4.1 = per-session sampling + coin metaphor).
7. `Documentation/FUTURE_THIRD_PARTY_INTEGRATION.md` — integration seams (M6 section added).
8. `Documentation/AGENT_RUN_LOG.csv` — audit trail of agent runs.

Past M1–M5 are settled and recorded in the docs above — don't re-litigate them.

## Key rules / gotchas

- A change isn't done until the relevant tests are green; if you didn't run them, say so.
- Run tests via the isolated runner `scripts/run-playwright-isolated.ps1` — it sets `HEATMAP_DB_SCHEMA=heatmap_test` so the suite never hits production data.
- If the `.ps1` is blocked by execution policy: set `$env:HEATMAP_DB_SCHEMA=heatmap_test` → start dev server → `npx playwright test`.
- Suite runs single-worker; current green count lives in `TEST_CASES.md` → M6.2 (don't hardcode it here). **Don't run the suite while `npm run dev` is up** — shared port 3000 + `.next` cache corrupts the build. If wedged: stop all dev servers → delete `.next` → start one fresh.
- Log every agent run in `Documentation/AGENT_RUN_LOG.csv` (append only).
- If tests change, update `TEST_CASES.md` + the `PRODUCT_OVERVIEW.md` test summary. If architecture changes, update `ARCHITECTURE_OVERVIEW.md`.
- Don't declare a milestone complete until `milestone-prereqs` returns READY.
- At checkpoints, suggest a new session and offer to refresh this file.
