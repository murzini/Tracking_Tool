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

- **M1–M6.2 CLOSED and signed off.** GitHub + Vercel live (`tracking-tool-kappa.vercel.app`, auto-deploys on push to `main`).
- **M7 Parts 1–9 DONE; Part 10 (close gates) READY TO START.** Report pipeline runs end-to-end with images working; manually tested against real + demo data. **All code changes are UNCOMMITTED** — do not push until M7 is fully closed.
- **This session's clone is `D:\Temp\Tracking_Tool`** (not `C:\Temp\...` as the Workflow note above says).
- **Unit tests 273/273 green (confirmed 2026-05-30).**
- **E2e suite: 80/80 green — confirmed 2026-05-30 (this session).** All flaky tests fixed.

### Test fixes completed this session

**Tests 36, 52, 53** — async-write race: tests read sessions immediately after a beacon flush before the DB write landed. Fixed with `expect.poll(...)` in `m4-session-signals.spec.ts` and `m6-config.spec.ts`.

**Test 54** (`m6-dashboard.spec.ts`) — stale server-side config cache: `app/dashboard/page.jsx` was calling `getHeatmapConfig()` (cached) for its SSR render. Tests 49–53 visit the checkout page, which warms the module-level `_cache`. The dashboard SSR then served a stale `initialConfig`.
- **Fix:** `app/dashboard/page.jsx` now calls `getHeatmapConfigFresh()` + marked `force-dynamic`. This ensures the dashboard always renders with the latest DB state regardless of `_cache`.
- **Key lesson:** SSR pages that must reflect the latest saved state must use fresh DB reads. The `_cache` is still valid for high-frequency ingest reads. The failure only appears in full-suite order because earlier tests warm the cache.

**Tests 44, 63** — fixed in prior session (carried).

### Unchanged context from prior sessions
- **Screenshot loading bug — FIXED (2026-05-30).** `data-heatmap-checkout-ready` added to `app/checkout/[sku]/heatmap/page.jsx`; `screenshots/route.js` waits on it. Not covered by automated test (logged as accepted debt).
- **Validation-error dot offset bug — FIXED (2026-05-29); Test 70 added + confirmed green (2026-05-30).**
- **Dashboard persistence — ADDED (2026-05-30).** `DashboardClient.jsx`: staged Data config → `heatmap-dashboard-staged`; Heatmap filters → `heatmap-dashboard-heatmap`. Persist/restore race fixed (Test 69). Tests 67 & 69 cover these paths.
- **Part 9 complete (2026-05-29):** charts/tables via Recharts; scope-driven screenshots; images async on client; bold formatting; Vercel-compatible screenshots.
- **Live-demo prep is built (2026-05-29).** 3-part demo wired (see `PRODUCT_OVERVIEW.md` → "Demo setup for the live walkthrough"). 22 real sessions frozen in `heatmap_demo` schema.
- **Key uncommitted code changes (`D:\Temp\Tracking_Tool`):**
  - `lib/prototype/checkoutHeatmapClient.js` — Test 44 fix: no `touchResume` on save-retry.
  - `lib/prototype/heatmapConfigStore.server.js` — `_cache = null` after save; `getHeatmapConfigFresh()` added.
  - `app/api/checkout-heatmap/config/route.js` — `force-dynamic`; GET uses `getHeatmapConfigFresh()`.
  - `app/dashboard/page.jsx` — `force-dynamic`; SSR uses `getHeatmapConfigFresh()` (Test 54 fix).
  - `app/dashboard/DashboardClient.jsx` — `heatmapHydrated` ref; demo subsection + `DemoTooltip`; heatmap past/present presets; localStorage persistence.
  - `tests/e2e/m4-session-signals.spec.ts` — Test 36 polling fix.
  - `tests/e2e/m6-config.spec.ts` — Tests 52, 53 polling fix.
  - `tests/e2e/m6-dashboard.spec.ts` — Test 54 polling fix (defensive; root cause fixed in page.jsx).
  - `tests/e2e/m6-sim.spec.ts` — Test 63 fix: delete sessions before dashboard nav; Test 61: warm-up + 60s timeout.
  - `lib/prototype/db.js` — `resolveHeatmapSchema` allowlist gained `demo`.
  - `scripts/db-setup.mjs` — added `heatmap_demo`, `heatmap_test_demo`.
  - `scripts/freeze-demo-sessions.mjs` (NEW) — idempotent copy of `public` → `heatmap_demo`.
  - `app/checkout/[sku]/heatmap/page.jsx` — `source=demo` support; `data-heatmap-checkout-ready` signal.
  - `app/api/checkout-heatmap/screenshots/route.js` — concurrent capture; waits on `data-heatmap-checkout-ready`.
  - `app/api/checkout-heatmap/report/route.js` — screenshot `AbortSignal.timeout` raised to 45s.
  - `next.config.mjs` — `serverComponentsExternalPackages` for `playwright-core` + `@sparticuz/chromium`.
  - **Earlier (carried):** model `claude-sonnet-4-6`; screenshots NOT sent to Claude; `MIN_SESSIONS_OPTIONS`; sim-report feature; empty-step bug fix.
  - **`.env.local`** holds `ANTHROPIC_API_KEY`, Neon `DATABASE_URL`, `DASHBOARD_TOKEN=dashboard-link` (local only — never commit).
- **Test debt (address in Part 10):** demo path (`source=demo`), heatmap past-presets, screenshot parallelisation, and `data-heatmap-checkout-ready` have no automated tests — log as accepted debt before close.
- **Docs updated 2026-05-30:** `PRODUCT_OVERVIEW.md` + `FUTURE_THIRD_PARTY_INTEGRATION.md`.
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` — INTENDED. See `DATA.md` → `exit_reason`.
- **Gotcha — suite startup:** If tests time out from Test 1, a stale dev server is holding port 3000. Fix: kill all node/npm processes → delete `.next` → re-run isolated runner. Do NOT run two dev servers at once.

## Next action

**START HERE — suite is 80/80 green. Proceed directly to M7 Part 10 close gates.**

**Step 1 — M7 Part 10 close gates:**
1. `milestone-doc-review`; tech-debt review; agent review. Decide on the test debt (demo path, past-presets, screenshot parallelisation, `data-heatmap-checkout-ready`).
2. Log the run in `AGENT_RUN_LOG.csv` (append only).
3. Commit all code + tests + docs **by explicit path** (never `git add -A`; never `.env.local`). Confirm `milestone-prereqs` → READY. Then push.

**M7 sequence:** ~~M7.1~~ → ~~M7.2~~ → ~~M7.3~~ → ~~Part 4~~ → ~~Part 5~~ → ~~Part 6~~ → ~~Part 7~~ → ~~Part 8~~ → ~~Part 9~~ → Part 10 (close gates). Full plan in `PRODUCT_OVERVIEW.md` → M7 → "M7 sequencing (parts)".

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
