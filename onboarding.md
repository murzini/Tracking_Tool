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
- **M6 — Admin Dashboard — IN PROGRESS. Parts 1–4 done and committed; Parts 5–6 to follow.**
  - **P1 DONE (`628b4b9`):** outcome-model unification — `advanced` → `completed`. Tests 37/42 updated.
  - **P2 DONE:** runtime config store + API — `heatmap_config` Postgres table (single-row), `lib/prototype/heatmapConfigStore.server.js`, `lib/prototype/dashboardAuth.js`, `app/api/checkout-heatmap/config/route.js` (GET public / POST+DELETE auth-gated). `DASHBOARD_TOKEN=m6-dev-token` in `.env.local`.
  - **P3 DONE:** capture reads runtime config (step / event-type / element-type / window / sampling gates; fail-open background fetch). Server ingest re-checks config on every batch (authoritative). Tests 49–53 in `tests/e2e/m6-config.spec.ts`.
  - **P4 DONE (`0655b49`):** dashboard `/dashboard?token=` (Shop-styled, one rounded block: Data / Heatmap / Report). Data section: MultiSelect Steps / Event types / Element types; Data-collecting timeframe; Drop-off timeframe (wired to `config.inactivityMs`); Sampling Rate; staged Save; Clear-data confirmation. Test 54 in `tests/e2e/m6-dashboard.spec.ts`.
  - **Bug fixes (in `0655b49`):** (1) capture-window date boundary — `from` parsed as local start-of-day, `to` as `T23:59:59.999` (both client + server ingest); (2) sampling reworked to per-session — each step visit flips its own coin, per-visitor `m1.heatmap.sampled` cookie and `resolveSamplingDecision` removed. Documented in `SCALE_DESIGN.md` §4.1.
  - **Test 54 fixed and confirmed (`bd20f71`):** step selectors updated from checkbox API to MultiSelect dropdown API (`aria-pressed` + `data-dashboard-steps-trigger`). **Suite: 64/64 green** (confirmed 2026-05-27).
  - **Parts 5–6 remaining:** Heatmap section + viewer outcome filter + timeframe (P5); header removal + Report placeholder + close (P6).
- **M6.1 — Heatmap Simulation Mode — FOLLOW-UP TO M6 (do AFTER M6, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.1". Not scope-frozen; needs its own `milestone-start`.
- **M6.2 — Unit Test Foundation — FOLLOW-UP TO M6 (do AFTER M6.1, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.2". Add a Vitest unit-test layer over the durable pure-logic core (heatmap normalize/finalize/drop-off/timing, **sampling, capture window**, config defaults, scanner) — targeted, not blanket. Both P3/P4 bugs were exactly that kind of pure-logic bug e2e missed. Not scope-frozen; needs its own `milestone-start`. **Don't skip from M6 straight to M7 — sequence is M6 → M6.1 → M6.2 → M7.**
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**Implement M6 Part 5 — Heatmap section + viewer outcome filter + timeframe.**

Tree is clean and committed (`bd20f71`); suite is 64/64 green. Begin immediately.

Dashboard **Heatmap** section (inside the single rounded block, between Data and Report, separated by thin lines):
- Step dropdown, desktop/mobile **icon** selector (not a text toggle), view-type dropdown (clicks/moves/scrolls), timeframe from/to date pickers, outcome dropdown (drop-offs / completers / all).
- A button that opens the viewer in a new tab with all params built into the URL (`?step=&view=&type=&from=&to=&outcome=`).
- The breathing heatmap icon (subtle pulse animation) goes here.

Extend `app/checkout/[sku]/heatmap/page.jsx`:
- Read new `outcome` + `from`/`to` URL params alongside the existing `step`/`view`/`type`.
- Add outcome predicate: drop-offs → `abandoned`; completers → `completed`; all → no restriction (includes `in-progress`).
- Add timeframe predicate on session timestamp.
- A selection with no matching data shows the existing no-data message.

*Manual check:* set filters → open viewer → shows only the filtered set; outcome=drop-offs shows only `abandoned`, completers only `completed`, all shows everything incl. `in-progress`; a timeframe outside captured data shows the no-data message.

Full spec: `Documentation/ARCHITECTURE_OVERVIEW.md` → M6 → "Implementation plan" → Part 5.
Pending tests: Tests 55–56 (`Documentation/TEST_CASES.md` → M6 → open items).

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
