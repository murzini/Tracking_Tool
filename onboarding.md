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
- **M6 — Admin Dashboard — IN PROGRESS. Parts 1–5 done; Part 6 to follow.**
  - **P1 DONE (`628b4b9`):** outcome-model unification — `advanced` → `completed`. Tests 37/42 updated.
  - **P2 DONE:** runtime config store + API — `heatmap_config` Postgres table (single-row), `lib/prototype/heatmapConfigStore.server.js`, `lib/prototype/dashboardAuth.js`, `app/api/checkout-heatmap/config/route.js` (GET public / POST+DELETE auth-gated). `DASHBOARD_TOKEN=m6-dev-token` in `.env.local`.
  - **P3 DONE:** capture reads runtime config (step / event-type / element-type / window / sampling gates; fail-open background fetch). Server ingest re-checks config on every batch (authoritative). Tests 49–53 in `tests/e2e/m6-config.spec.ts`.
  - **P4 DONE (`0655b49`):** dashboard `/dashboard?token=` (Shop-styled, one rounded block: Data / Heatmap / Report). Data section: MultiSelect Steps / Event types / Element types; Data-collecting timeframe; Drop-off timeframe (wired to `config.inactivityMs`); Sampling Rate; staged Save; Clear-data confirmation. Test 54 in `tests/e2e/m6-dashboard.spec.ts`.
  - **Bug fixes (in `0655b49`):** (1) capture-window date boundary — `from` parsed as local start-of-day, `to` as `T23:59:59.999` (both client + server ingest); (2) sampling reworked to per-session — each step visit flips its own coin, per-visitor `m1.heatmap.sampled` cookie and `resolveSamplingDecision` removed. Documented in `SCALE_DESIGN.md` §4.1.
  - **Test 54 fixed and confirmed (`bd20f71`):** step selectors updated from checkbox API to MultiSelect dropdown API (`aria-pressed` + `data-dashboard-steps-trigger`). **Suite: 64/64 green** (confirmed 2026-05-27).
  - **P5 DONE — NOT yet committed (2026-05-27):** dashboard Heatmap section + viewer outcome/timeframe filter. `app/dashboard/DashboardClient.jsx` — Heatmap section now has: Step dropdown, desktop/mobile **icon** selector, Type dropdown (clicks/moves/scrolls), Timeframe (reuses `CaptureWindowSelect`), Outcome dropdown (all / drop-offs / completers), **Open heatmap** button (builds `?step=&view=&type=&from=&to=&outcome=`, opens new tab via `window.open`), breathing heatmap icon. `app/checkout/[sku]/heatmap/page.jsx` — reads `outcome` + `from`/`to` params, filters `viewSessions` (abandoned/completed/all + `startedAt` window with from=start-of-day / to=end-of-day), threads the filters through the view/type toggle links, and adds `data-heatmap-session-count` for tests. Tests 55–56 in `tests/e2e/m6-heatmap-viewer.spec.ts` (+ `TEST_CASES.md` updated). **66 tests total; 55+56 green; full run = 65 green + Test 53 flake (see below).**
  - **Part 6 remaining:** header removal + Report placeholder + close (P6).
- **M6.1 — Heatmap Simulation Mode — FOLLOW-UP TO M6 (do AFTER M6, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.1". Not scope-frozen; needs its own `milestone-start`.
- **M6.2 — Unit Test Foundation — FOLLOW-UP TO M6 (do AFTER M6.1, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.2". Add a Vitest unit-test layer over the durable pure-logic core (heatmap normalize/finalize/drop-off/timing, **sampling, capture window**, config defaults, scanner) — targeted, not blanket. Both P3/P4 bugs were exactly that kind of pure-logic bug e2e missed. Not scope-frozen; needs its own `milestone-start`. **Don't skip from M6 straight to M7 — sequence is M6 → M6.1 → M6.2 → M7.**
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**First: commit P5.** It is done and green but uncommitted — the restore point is missing. Stage by explicit path (never `git add -A`; keep `.env.local` and `test-results/` out): `app/dashboard/DashboardClient.jsx`, `app/checkout/[sku]/heatmap/page.jsx`, `tests/e2e/m6-heatmap-viewer.spec.ts`, `Documentation/TEST_CASES.md`, `onboarding.md`.

**Then: implement M6 Part 6 — remove Shop header controls + Report placeholder + close.**

- **Delete (not hide)** from the **live Shop** `TopBar` (`components/prototype/TopBar.jsx` + callers in `shopRuntime.js` / the checkout page): the Heatmap step dropdown, Clear-data button, desktop/mobile + clicks/moves/scrolls toggles, and the moves/scrolls header note — i.e. the `showM1Actions` block; callers stop passing those props.
- The dashboard Heatmap section (P5) is now the **sole** entry to the viewer; Clear-data lives only in the dashboard Data section. The heatmap **viewer page** keeps the top-bar note slot it fills itself (that is the viewer, not the live Shop) — do not strip the viewer.
- **Report** placeholder button already exists in the dashboard (disabled / "not yet implemented") — confirm it stays.
- **Rewrite Test 2** (Clear data) and **Test 3** (Heatmap step dropdown) — they click Shop-header controls P6 deletes. Re-point onto the dashboard / auth-gated `DELETE` path; fix any flow helper that opens the heatmap via the header.

*Then run the close gates (M6 complete):* `milestone-doc-review`; tech-debt review (record all M6 debt, resolve every critical item); agent review (esp. `heatmap-qa` — outcome + capture-gating); `FUTURE_THIRD_PARTY_INTEGRATION.md` + `DATA.md` review; commit a clean tree; `milestone-prereqs` → READY.

*Manual check:* the live Shop renders with **no** heatmap/admin UI; the dashboard is the only way to view the heatmap or clear data; full suite green.

Full spec: `Documentation/ARCHITECTURE_OVERVIEW.md` → M6 → "Implementation plan" → Part 6.

**Known flake:** Test 53 (`m6-config.spec.ts`) can fail in a full run due to test-ordering/config state; it passes in isolation (`npx playwright test m6-config.spec.ts --grep "Test 53"`). Not a regression — don't chase it as one.

## What to read first, in order

**Essential — read before M6 P6 work:**
1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` → M6 scope — Part 6 spec (Shop header removal + Report placeholder + close gates).
3. `Documentation/TEST_CASES.md` → M6 — Tests 49–56 done; Tests 2/3 need rewriting (header controls being removed).
4. `Documentation/ARCHITECTURE_OVERVIEW.md` → M6 → "Implementation plan" Part 6 for the detailed build spec.

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
