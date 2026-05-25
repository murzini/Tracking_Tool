# Session Onboarding

Quick start for a new session. **Review and trim this file at the start of every session — rewrite it to the current state, don't pile new notes on top.** Keep only what the next session needs to act. Detail lives in the docs; this file points to them.

**Only "Current state" and "Next action" change each session — replace them. Everything else is stable structure; keep it.**

## What this project is

A heatmap product on a Next.js sandbox (Shop). It records visitor behaviour on the three checkout steps and shows it as overlays, to learn why people drop off. A POC, meant for later integration into Autohero.

**Local repo:** `C:\My AI Projects\M0`

## Current state

- **M1, M2, M3, M4** — COMPLETE and signed off.
- **M4 closed 2026-05-26.** All 9 prerequisites met: 52/52 tests green (Tests 36+44 `test.fixme`/deferred); all docs current per `milestone-doc-review` GAPS-FIXED; tech debt reviewed (all 7 critical resolved); git clean. Close gates: `milestone-doc-review` logged GAPS-FIXED 2026-05-26 10:30, `milestone-prereqs` logged OK 2026-05-26 01:39.
  - **M4 deliverables:** Extended interaction capture (mouse-move throttled ~100ms, scroll depth 0–100, field focus/blur/change, visibility depth tracking); batched ingest pipe (5s or 50-event flush + unload beacon); sampling gate (visitor cookie); outcomes (abandoned/advanced/completed/in-progress); exit reasons (idle/nav-click/back/left-browser); step timing (active/idle/duration); lazy finalize (X grace window, `POST /sweep`); rich event polymorphism (click/tap/mouse-move/scroll/field-focus/field-blur/field-change/validation-error/element-visible/element-hidden); heatmap rendering (click dots opacity-by-count, mouse-move trails with volume-aware alpha, scroll color-by-depth gradient with legend).
  - **Manual-check fixes (committed 681797c):** (1) Click dots now use one shared screen-wide scale across surface + fixed groups (was per-group, causing visual confusion). (2) Mouse-move/scroll views render in capture-time layout (validation off, accordions collapsed) so trails align with elements. (3) Visibility events no longer count as activity (partial session-merge fix).
  - **Deferred to M5:** Tests 36 (zero-interaction bounce) + 44 (session-merge reproducer) marked `test.fixme`. Test 36 never finalizes because zero-click sessions skip the finalize path (M1 rule: requires ≥1 click). Test 44 still fails even with the visibility fix — another passive source still refreshes the resume clock. Both need the M5 session-merge fix.
- **M5 — Login Step and Individual Session Attribution** — STARTS HERE.
  - **Scope frozen** (documented in `PRODUCT_OVERVIEW.md` → M5 section). Two independent tasks: (1) **session-merge bug fix (first task)** — diagnose and fix the remaining passive activity source, enable Tests 44+36; (2) **model-selector helper agent** — recommends model by task type + prompts on task start (scope + tier mapping TBD at M5 start).
  - **Also in scope:** add a lightweight login step between Details and Personal Information, create named/unique sessions for visitor attribution. This is the core M5 feature (spec in `PRODUCT_OVERVIEW.md` → M5 scope after the two tasks above).
- **Still deferred to the user:** the `PRODUCT_OVERVIEW.md` structural split.
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED ("left, not finalized, may return within X"). See `DATA.md` → `exit_reason`.

## Next action

**M5 starts.** The session-merge bug fix is the **first task** (deferred from M4). Do these in order:

- **Run `milestone-start` → confirm READY** — M4 closed, M5 scope frozen + specified, tech debt reviewed, arch/impl plan + test plan available (see `PRODUCT_OVERVIEW.md` → M5 scope).
- **Session-merge bug fix (first task in M5):**
  - Read `PRODUCT_OVERVIEW.md` → M5 scope, item 1 — diagnosis + recommended fix.
  - Root cause: passive events (non-user / passive interactions) refresh the resume/idle clock, preventing sessions from idling out. The M4 partial fix (visibility ≠ activity) is insufficient; another source still refreshes the clock.
  - Test 44 reproducer is ready in `tests/e2e/m4-session-signals.spec.ts` (marked `test.fixme`); enable it (remove `.fixme`) once the fix lands, re-run suite to verify green.
  - Test 36 (zero-interaction bounce) will also be enabled when the fix lands (same reproducer — zero-click sessions never finalize because `clearResumeRef` only runs on finalize, which requires ≥1 click). Mark it `test.fixme` and remove when Test 44 passes.
- **Then: model-selector helper agent** — scope + tier mapping TBD at M5 start (see `PRODUCT_OVERVIEW.md` → M5 scope, item 2).
- **Then: login step feature** — lightweight step between Details and Personal Information; creates named/unique sessions (scope in `PRODUCT_OVERVIEW.md` → M5 scope after the two tasks above).
- **Commit per part/chunk**, as recommended in `AGENTS.md` → Completion and testing.

## What to read first, in order

**Essential — read before the M4 close work:**
1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` → M4 — decisions, tech debt, business rules.
3. `Documentation/ARCHITECTURE_OVERVIEW.md` → M4 Part 8 — the close plan + doc-trim list.
4. `Documentation/TEST_CASES.md` → M4 — test plan + current green count.

**Reference — read as needed:**
5. `Documentation/DATA.md` — Postgres schema (`sessions` + `events`); `exit_reason` semantics.
6. `Documentation/SCALE_DESIGN.md` — batching / ingestion / sampling blueprint.
7. `Documentation/FUTURE_THIRD_PARTY_INTEGRATION.md` — integration seams.
8. `Documentation/AGENT_RUN_LOG.csv` — audit trail of agent runs.

Past M1–M3 and M4 Parts 1–7 + the Part 8 rendering port are settled and recorded in the docs above — don't re-litigate them.

## Key rules / gotchas

- A change isn't done until the relevant tests are green; if you didn't run them, say so.
- Run tests via the isolated runner `scripts/run-playwright-isolated.ps1` — it sets `HEATMAP_DB_SCHEMA=heatmap_test` so the suite never hits production data.
- If the `.ps1` is blocked by execution policy: set `$env:HEATMAP_DB_SCHEMA=heatmap_test` → start dev server → `npx playwright test`.
- Suite runs single-worker; current green count lives in `TEST_CASES.md` → M4 (don't hardcode it here). **Don't run the suite while `npm run dev` is up** — shared port 3000 + `.next` cache corrupts the build. If wedged: stop all dev servers → delete `.next` → start one fresh. (Tip: don't start your own dev server on another port either — it shares `.next` and can wedge the runner.)
- Log every agent run in `Documentation/AGENT_RUN_LOG.csv` (append only).
- If tests change, update `TEST_CASES.md` + the `PRODUCT_OVERVIEW.md` test summary. If architecture changes, update `ARCHITECTURE_OVERVIEW.md`.
- Don't declare a milestone complete until `milestone-prereqs` returns READY.
- At checkpoints, suggest a new session and offer to refresh this file.
