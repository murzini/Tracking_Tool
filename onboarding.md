# Session Onboarding

Quick start for a new session. **Review and trim this file at the start of every session — rewrite it to the current state, don't pile new notes on top.** Keep only what the next session needs to act. Detail lives in the docs; this file points to them.

**Only "Current state" and "Next action" change each session — replace them. Everything else is stable structure; keep it.**

## What this project is

A heatmap product on a Next.js sandbox (Shop). It records visitor behaviour on the three checkout steps and shows it as overlays, to learn why people drop off. A POC, meant for later integration into Autohero.

**Local repo:** `C:\My AI Projects\M0`

## Model selection

At the start of each task, I assess whether the current model tier is the best fit (see `.claude/agents/model-selector.md` for the 3-tier mapping: Opus = hard reasoning/architecture; Sonnet = everyday coding/agents; Haiku = mechanical tasks). 

**Behavior:** I emit a one-line verdict before proceeding to work:
- If the current model fits: `Model: <tier> OK — <reason>`
- If it doesn't fit: `Suggest /model <tier> — <reason>`

**Important:** I never shift the model implicitly (e.g., via subagent override or workaround). You control all transitions — you decide whether to switch the main session model. I prompt, you switch, I proceed.

**Enforcement hooks:** a `UserPromptSubmit` hook in `.claude/settings.json` injects the model-fit reminder on every prompt automatically. This is a safety net — the proactive one-line verdict is still required before any work.

See `CLAUDE.md` → "Model selection" for the full rule.

## Current state

- **M1–M5 COMPLETE and signed off.** M5 (Login Step + Visitor Attribution) closed 2026-05-26. Per-milestone detail lives in `PRODUCT_OVERVIEW.md`.
- **M6 — Admin Dashboard — IN PROGRESS. Parts 1–4 done; Parts 5–6 to follow.**
  - **P1 DONE (committed `628b4b9`):** outcome-model unification — `advanced` → `completed`. Tests 37/42 updated.
  - **P2 DONE:** runtime config store + API — `heatmap_config` Postgres table (single-row), `lib/prototype/heatmapConfigStore.server.js`, `lib/prototype/dashboardAuth.js`, `app/api/checkout-heatmap/config/route.js` (GET public / POST+DELETE auth-gated). `DASHBOARD_TOKEN=m6-dev-token` in `.env.local`.
  - **P3 DONE:** capture reads runtime config (step / event-type / element-type / window / sampling gates; fail-open background fetch). Server ingest re-checks config on every batch (authoritative). Tests 49–53 in `tests/e2e/m6-config.spec.ts`.
  - **P4 DONE:** dashboard `/dashboard?token=` (Shop-styled, one rounded block: Data / Heatmap / Report). Data section: MultiSelect Steps / Event types / Element types; Data-collecting timeframe; Drop-off timeframe (wired to `config.inactivityMs`); Sampling Rate; staged Save; Clear-data confirmation. Test 54 in `tests/e2e/m6-dashboard.spec.ts`.
  - **BUG FIXES THIS SESSION (2026-05-27) — in delivered P3/P4 capture code (found via manual dashboard testing):**
    1. **Capture-window date boundary FIXED.** A `from`/`to` date like "Today" was parsed as **midnight UTC = start of day**, so any timeframe preset closed the window for the rest of the day and the **server ingest gate silently dropped every session** (empty DB). Fixed in BOTH places: client `isCaptureWindowOpen` (`checkoutHeatmapClient.js`) and the server ingest route (`app/api/checkout-heatmap/ingest/route.js`) — parse `from` as local **start**-of-day, `to` as local **end**-of-day (`T23:59:59.999`).
    2. **Sampling reworked to PER-SESSION.** Old code never applied intermediate rates (any rate > 0 captured 100%; only 0% disabled) and was per-visitor (sticky cookie). Now **each session (one step visit) flips its own coin** at the effective rate; the per-visitor `m1.heatmap.sampled` cookie and `resolveSamplingDecision` were removed; `checkoutHeatmapSampling.js` keeps only `resolveSamplingRate`. **Rationale (user-confirmed):** measure **per-step conversion**, not whole journeys — a visitor's journey may be partially captured, which is fine. Coin metaphor + 3-step worked example documented in `SCALE_DESIGN.md` §4.1.
    - **Verified by Node logic only** (50% → ~50% over 10k; 0/100 deterministic; query-param override + resumed-stays-sampled). The probability is **client-side**. **The Playwright suite was NOT run this session** (your dev server was up — running it risks `.next` corruption).
  - **⚠ EVERYTHING IS UNCOMMITTED** — P4 work + this session's fixes + all doc updates. Full file list in Next action → Step 1.
  - **⚠ Test 54 still broken (unchanged from before):** its step toggles use the old `.toBeChecked`/`.uncheck` (checkbox) API; the UI now uses MultiSelect dropdowns. Must be updated before the suite can pass.
  - **⚠ Test 30 changed this session:** cookie assertions removed (per-session model). Must be re-confirmed on the next suite run.
  - **Parts 5–6 remaining:** Heatmap section + viewer outcome filter + timeframe (P5); header removal + Report placeholder + close (P6).
- **M6.1 — Heatmap Simulation Mode — FOLLOW-UP TO M6 (do AFTER M6, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.1". Not scope-frozen; needs its own `milestone-start`.
- **M6.2 — Unit Test Foundation — FOLLOW-UP TO M6 (do AFTER M6.1, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.2". Add a Vitest unit-test layer over the durable pure-logic core (heatmap normalize/finalize/drop-off/timing, **sampling, capture window**, config defaults, scanner) — targeted, not blanket. Both bugs this session were exactly that kind of pure-logic bug e2e missed. Not scope-frozen; needs its own `milestone-start`. **Don't skip from M6 straight to M7 — sequence is M6 → M6.1 → M6.2 → M7.**
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**Step 1 — Commit all outstanding work.** Stage **by explicit path** (not `git add -A`, to keep `.env.local` and `test-results/` out). Git-verified set as of this handoff (17 paths — 3 new, 14 modified):
- *New / untracked:* `app/dashboard/page.jsx`, `app/dashboard/DashboardClient.jsx`, `tests/e2e/m6-dashboard.spec.ts` (Test 54)
- *Modified — code:* `lib/prototype/checkoutHeatmapClient.js`, `lib/prototype/checkoutHeatmapSampling.js`, `app/api/checkout-heatmap/ingest/route.js`, `lib/prototype/heatmapConfigStore.server.js`
- *Modified — tests:* `tests/e2e/m4-ingest.spec.ts` (Test 30 → per-session, cookie assertions removed)
- *Modified — docs:* `Documentation/PRODUCT_OVERVIEW.md`, `Documentation/ARCHITECTURE_OVERVIEW.md`, `Documentation/TEST_CASES.md`, `Documentation/DATA.md`, `Documentation/SCALE_DESIGN.md`, `Documentation/FUTURE_THIRD_PARTY_INTEGRATION.md`, `onboarding.md`
- *Modified — agents:* `.claude/agents/test-impact.md`, `.claude/agents/heatmap-qa.md`
- A single commit is fine, or split P4 (dashboard + Test 54 + config docs) from the two bug fixes (capture-window + per-session sampling).

**Step 2 — Fix Test 54** (`tests/e2e/m6-dashboard.spec.ts`). Replace the checkbox API (`.toBeChecked`/`.uncheck`) with the MultiSelect dropdown API: open the Steps MultiSelect, toggle via `data-dashboard-step` options, assert state via `aria-pressed` (or visible text), then Save.

**Step 3 — Run the full suite with the dev server DOWN.** The isolated runner `scripts/run-playwright-isolated.ps1` starts its own server (`HEATMAP_DB_SCHEMA=heatmap_test`). Re-confirm **Test 30** (now per-session, no cookie) and **Test 54** are green and record the new total. The old "64/64" baseline is stale (Test 30 changed; Test 54 was broken). Intermediate-rate sampling probability is **not** e2e-tested — it's logic-only for now (→ M6.2 unit tests).

**Step 4 — Implement M6 Part 5 — Heatmap section + viewer outcome filter + timeframe.**

Dashboard Heatmap section: step dropdown, desktop/mobile icon selector, view-type dropdown (clicks/moves/scrolls), timeframe (from/to), outcome dropdown (drop-offs/completers/all) → a button that opens the viewer in a new tab. Extend `app/checkout/[sku]/heatmap/page.jsx` to read `outcome` + `from`/`to` params and filter sessions accordingly.

*Manual check for P5:* set filters → open viewer → shows only the filtered set; outcome=drop-offs shows only `abandoned`, completers shows only `completed`, all shows everything; a timeframe outside captured data shows the no-data message.

- Tree must be **clean and committed** before starting P5.

## What to read first, in order

**Essential — read before M6 P5 work:**
1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` → M6 scope — Part 5 spec (Heatmap section + viewer outcome filter).
3. `Documentation/TEST_CASES.md` → M6 — Tests 49–54 done; Tests 55–56 still pending (viewer filter, header removal).
4. `Documentation/ARCHITECTURE_OVERVIEW.md` → M6 → "Implementation plan" Part 5 for the detailed build spec.

**Reference — read as needed:**
5. `Documentation/DATA.md` — Postgres schema (`sessions` + `events`); `exit_reason` semantics.
6. `Documentation/SCALE_DESIGN.md` — batching / ingestion / sampling blueprint (§4.1 = per-session sampling + coin metaphor).
7. `Documentation/FUTURE_THIRD_PARTY_INTEGRATION.md` — integration seams.
8. `Documentation/AGENT_RUN_LOG.csv` — audit trail of agent runs.

Past M1–M5 are settled and recorded in the docs above — don't re-litigate them.

## Key rules / gotchas

- A change isn't done until the relevant tests are green; if you didn't run them, say so.
- Run tests via the isolated runner `scripts/run-playwright-isolated.ps1` — it sets `HEATMAP_DB_SCHEMA=heatmap_test` so the suite never hits production data.
- If the `.ps1` is blocked by execution policy: set `$env:HEATMAP_DB_SCHEMA=heatmap_test` → start dev server → `npx playwright test`.
- Suite runs single-worker; current green count lives in `TEST_CASES.md` → M4 (don't hardcode it here). **Don't run the suite while `npm run dev` is up** — shared port 3000 + `.next` cache corrupts the build. If wedged: stop all dev servers → delete `.next` → start one fresh. (Tip: don't start your own dev server on another port either — it shares `.next` and can wedge the runner.)
- Log every agent run in `Documentation/AGENT_RUN_LOG.csv` (append only).
- If tests change, update `TEST_CASES.md` + the `PRODUCT_OVERVIEW.md` test summary. If architecture changes, update `ARCHITECTURE_OVERVIEW.md`.
- Don't declare a milestone complete until `milestone-prereqs` returns READY.
- At checkpoints, suggest a new session and offer to refresh this file.
