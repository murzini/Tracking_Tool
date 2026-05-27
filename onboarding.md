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
- **M6 — Admin Dashboard — IN PROGRESS. Parts 1–3 done; Parts 4–6 to follow. 63/63 tests passing.**
  - **Part 1 DONE (2026-05-27):** Outcome-model unification — `advanced` → `completed`. Tests 37/42 updated. Committed `628b4b9`.
  - **Part 2 DONE (2026-05-27):** Runtime config store + API. New: `heatmap_config` Postgres table (single-row), `lib/prototype/heatmapConfigStore.server.js` (get/save/delete + write-through cache), `lib/prototype/dashboardAuth.js` (constant-time token check), `app/api/checkout-heatmap/config/route.js` (GET public / POST+DELETE auth-gated). `DASHBOARD_TOKEN=m6-dev-token` in `.env.local`.
  - **Part 3 DONE (2026-05-27):** Capture reads runtime config. Client fetches config on init (background, fail-open); aborts session if step/sampling/window gates fail. Ingest endpoint rechecks config on every batch (authoritative, timing-independent) — drops session if step disabled or samplingRate≤0, filters event array by disabled event types. `checkoutHeatmapSampling.js` precedence updated (query-param → runtime config → env → default).
  - Tests 49–53 added in `tests/e2e/m6-config.spec.ts`. **63/63 green.**
  - **Parts 4–6 remaining:** dashboard shell + Data section UI (P4); Heatmap section + viewer outcome filter + timeframe (P5); header removal + Report placeholder + close (P6). No UI built yet — P1-P3 are backend-only.
- **M6.1 — Heatmap Simulation Mode — FOLLOW-UP TO M6 (do AFTER M6, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.1". Not scope-frozen; needs its own `milestone-start`. **Don't skip from M6 straight to M7.**
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**Implement M6 Part 4 — Dashboard shell + auth gate + Data section.**

Build `/dashboard?token=<token>` route (Shop-styled, narrow/centered, desktop-only), the three section headers (Data / Heatmap / Report), and the full **Data** section: 8 config items (steps, capture-window, drop-off threshold display-only, element types, event types, sampling presets, desktop/mobile, clear-data) with staged edits + one **Save** button; **Clear-data** as an immediate action behind a confirmation pop-up.

The backend (config store + auth) is already in place from P2. P4 is pure UI wiring.

*Manual check for P4:* open `/dashboard?token=m6-dev-token` → dashboard renders; wrong/missing token → blocked; toggle steps/types/sampling + Save → `GET /api/checkout-heatmap/config` reflects the change; Clear-data pop-up → confirm → `GET /api/checkout-heatmap` returns empty.

- Current suite baseline: **63/63 active tests passing** (see `TEST_CASES.md` → M6).
- Tree is **clean after this session's commit** — start fresh without any uncommitted changes.

## What to read first, in order

**Essential — read before M6 P4 work:**
1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` → M6 scope — Admin Dashboard spec (key decisions: layout, sections, Save model, Clear-data, sampling presets).
3. `Documentation/TEST_CASES.md` → M6 — Tests 49–53 done; Tests 54–56 still pending (dashboard UI, viewer filter, header removal).
4. `Documentation/ARCHITECTURE_OVERVIEW.md` → M6 → "Implementation plan" Part 4 for the detailed build spec.

**Reference — read as needed:**
5. `Documentation/DATA.md` — Postgres schema (`sessions` + `events`); `exit_reason` semantics.
6. `Documentation/SCALE_DESIGN.md` — batching / ingestion / sampling blueprint.
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
