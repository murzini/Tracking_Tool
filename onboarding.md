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

- **M1, M2, M3, M4** — COMPLETE and signed off.
- **M4 closed 2026-05-26.** All 9 prerequisites met. Close gates: `milestone-doc-review` logged GAPS-FIXED 2026-05-26 10:30, `milestone-prereqs` logged OK 2026-05-26 01:39.
- **M5 — Login Step and Individual Session Attribution** — IN PROGRESS. All planning gaps closed; `milestone-start` returned READY 2026-05-26 19:42.
  - **Model-selector agent — DONE (2026-05-26).** Built at `.claude/agents/model-selector.md`.
  - **Session-merge bug fix — DONE (2026-05-26).** `appendCheckoutHeatmapEvent` no longer touches `lastInteractionAt` when `resetActivity:false`; `hasClicks` gate removed from `saveSession` and `isCheckoutHeatmapDropOffCandidate`. Tests 36 + 44 un-skipped; **54/54 suite green**. Full spec in `PRODUCT_OVERVIEW.md` → M5 scope item 1.
  - **Login step spec — FULLY SPECIFIED (2026-05-26).** All decisions agreed. Step key `login`, CTA "Continue", not shown in step nav, `visitor_id` stored in DB only (not in query API). Full spec in `PRODUCT_OVERVIEW.md` → M5 scope item 3 + `FUTURE_THIRD_PARTY_INTEGRATION.md` → M5.
  - **MovesNote mobile layout — fixed (2026-05-26).** Yellow note on mobile heatmap now renders as a horizontal strip below the top-bar logo row (single render, no duplication).
  - **Anticipated M5 tech debt — recorded (2026-05-26).** 8 non-critical items in `PRODUCT_OVERVIEW.md` → Tech Debt → Anticipated (M5).
  - **M5 architecture + 3-part implementation plan — documented (2026-05-26).** In `ARCHITECTURE_OVERVIEW.md` → M5.
  - **milestone-test-planning — OK (2026-05-26 19:38).** Keep 7, update ~47 (login step in full-flow helpers), remove 0, +4 new (Tests 45–48). Logged in `AGENT_RUN_LOG.csv`.
  - **milestone-start — READY (2026-05-26 19:42).** All 7 prerequisites met. Logged in `AGENT_RUN_LOG.csv`.
  - **Part 1 — Schema migration + login step UI — DONE (2026-05-26).** `visitor_id TEXT` column added to both `public` and `heatmap_test` via idempotent ALTER in `db-setup.mjs`. Login step renders in `CheckoutFlow.jsx` (name required, password optional, CTA "Continue"); excluded from step nav; `?step=login` is the new checkout default (`resolveStep`); heatmap capture disabled on login step. Manual check passed: login screen on entry, PI/Delivery/Pay nav only, empty name blocked, valid name → Personal Information.
- **Still deferred to the user:** the `PRODUCT_OVERVIEW.md` structural split.
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**Part 1 DONE — start Part 2.** Implementation plan in `ARCHITECTURE_OVERVIEW.md` → M5 → Implementation plan.

- **Part 2 — Visitor ID generation + session attribution.**
  - New `lib/prototype/checkoutVisitorId.js`: `mintVisitorId()` generates UUID + writes to localStorage (`m1.heatmap.visitorId`); `getVisitorId()` reads it back.
  - Wire `mintVisitorId()` into login Continue handler in `CheckoutFlow.jsx`.
  - `checkoutHeatmapClient.js`: on init call `getVisitorId()` and attach to session payload.
  - `checkoutHeatmapStore.server.js`: write `visitor_id` in `ingestCheckoutHeatmapBatch` (COALESCE-protected upsert).
  - `checkoutHeatmap.js`: `normalizeCheckoutHeatmapSession` round-trips `visitor_id`.
  - `DATA.md`: document new `visitor_id` column.
  - Manual check: complete login → drop off on PI → inspect DB → session has `visitor_id`; second drop-off in same browser → same `visitor_id`; incognito login → different `visitor_id`.
- **Part 3 — Tests + close gates.** (after Part 2 manual check passes)
- **Commit per part**, as recommended in `AGENTS.md` → Completion and testing.

## What to read first, in order

**Essential — read before M5 work:**
1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` → M5 scope — session-merge fix (DONE) + login step spec (FULLY SPECIFIED).
3. `Documentation/TEST_CASES.md` → M4 — current green count is 54/54 (Tests 36 + 44 now active).
4. `Documentation/ARCHITECTURE_OVERVIEW.md` → M5 — 3-part implementation plan for the login step. Also read → M4 for session lifecycle context.

**Reference — read as needed:**
5. `Documentation/DATA.md` — Postgres schema (`sessions` + `events`); `exit_reason` semantics.
6. `Documentation/SCALE_DESIGN.md` — batching / ingestion / sampling blueprint.
7. `Documentation/FUTURE_THIRD_PARTY_INTEGRATION.md` — integration seams.
8. `Documentation/AGENT_RUN_LOG.csv` — audit trail of agent runs.

Past M1–M4 are settled and recorded in the docs above — don't re-litigate them.

## Key rules / gotchas

- A change isn't done until the relevant tests are green; if you didn't run them, say so.
- Run tests via the isolated runner `scripts/run-playwright-isolated.ps1` — it sets `HEATMAP_DB_SCHEMA=heatmap_test` so the suite never hits production data.
- If the `.ps1` is blocked by execution policy: set `$env:HEATMAP_DB_SCHEMA=heatmap_test` → start dev server → `npx playwright test`.
- Suite runs single-worker; current green count lives in `TEST_CASES.md` → M4 (don't hardcode it here). **Don't run the suite while `npm run dev` is up** — shared port 3000 + `.next` cache corrupts the build. If wedged: stop all dev servers → delete `.next` → start one fresh. (Tip: don't start your own dev server on another port either — it shares `.next` and can wedge the runner.)
- Log every agent run in `Documentation/AGENT_RUN_LOG.csv` (append only).
- If tests change, update `TEST_CASES.md` + the `PRODUCT_OVERVIEW.md` test summary. If architecture changes, update `ARCHITECTURE_OVERVIEW.md`.
- Don't declare a milestone complete until `milestone-prereqs` returns READY.
- At checkpoints, suggest a new session and offer to refresh this file.
