# Session Onboarding

Quick start for a new session. **Review and trim this file at the start of every session — rewrite it to the current state, don't pile new notes on top.** Keep only what the next session needs to act. Detail lives in the docs; this file points to them.

**Only "Current state" and "Next action" change each session — replace them. Everything else is stable structure; keep it.**

## What this project is

A heatmap product on a Next.js sandbox (Shop). It records visitor behaviour on the three checkout steps and shows it as overlays, to learn why people drop off. A POC, meant for later integration into Autohero.

**Local repo:** `C:\My AI Projects\M0`

## Current state

- **M1, M2, M3** — COMPLETE and signed off.
- **M4 — Extended Interaction Capture** — IN PROGRESS, scope FROZEN. Parts 1–8 done. Part 8 rendering: clicks opacity-by-count, mouse-move trails (volume-aware alpha), scroll green tint + "<n>% saw it" legend; density/fold-line/`?style=` toggle removed. Detail: `PRODUCT_OVERVIEW.md` + `ARCHITECTURE_OVERVIEW.md` → M4 Part 8.
- **This session (2026-05-25) — three manual-check fixes, ALL UNCOMMITTED:**
  1. **Click dots — one shared screen-wide scale.** Was scaled per-group (surface vs `position:fixed`), so equal-looking dots could have very different counts. Now a single `maxCount` across both groups drives size + opacity (`buildAnchorAwarePoints` in `app/checkout/[sku]/heatmap/page.jsx`).
  2. **Mouse-move/scroll views now render in the capture-time layout** (validation off + accordions collapsed) so trails line up with the elements; the clicks view stays fully expanded (needs error anchors). New `forceExpandedLayout` prop on `CheckoutFlow.jsx`, wired from the heatmap page. Tests 39/40 assert it.
  3. **Session-merge bug — DIAGNOSED, DEFERRED TO M5 (its first task).** Repeated visits to the same step+sku merge into one ever-living `in-progress` session (heatmap/DB show only 1). Cause: passive events refresh the resume/idle clock so the session never idles out → every return resumes. A partial change is **kept** (visibility no longer counts as activity — `recordSessionEvent(..., {resetActivity:false})`) but is **insufficient** — another passive source remains. Repro = **Test 44** (`test.fixme`). Full diagnosis + fix plan: `PRODUCT_OVERVIEW.md` → M5 scope.
- **Tests:** suite re-run 2026-05-26 → **52 passed, 2 `test.fixme` (skipped), 0 failed.** Test 44 (session-merge) and Test 36 (zero-interaction bounce) are both `test.fixme` — deferred to M5. Green baseline is now 52/52 active tests.
- **Git:** prior commits on branch `chore/shop-tech-debt-clean` (`193e4c9` … `d63ed94`, local only, not pushed). **This session's changes are ALL UNCOMMITTED — working tree is DIRTY.** Touched: `heatmap/page.jsx`, `CheckoutFlow.jsx`, `checkoutHeatmapClient.js`, `tests/e2e/m4-rendering.spec.ts`, `tests/e2e/m4-session-signals.spec.ts`, `PRODUCT_OVERVIEW.md`, `ARCHITECTURE_OVERVIEW.md`, `TEST_CASES.md`, this file, and a `milestone-prereqs` GAPS-OPEN line in `AGENT_RUN_LOG.csv`.
- **Deferred to M5** (see `PRODUCT_OVERVIEW.md` → M5 scope): (1) the session-merge fix — **first task** (also enables Test 44 + Test 36); (2) a **model-selector helper agent** (recommends Opus/Sonnet/Haiku by task; scope + tiers TBD).
- **Still deferred to the user:** the `PRODUCT_OVERVIEW.md` structural split.
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED ("left, not finalized, may return within X"). See `DATA.md` → `exit_reason`.

## Next action

**Finish the M4 close.** The session-merge bug is now out of M4 scope (moved to M5), so it no longer blocks. Do these in order:

- ~~**Re-run the suite**~~ **DONE (2026-05-26) — 52/52 green. Tests 36 + 44 are `test.fixme` (deferred to M5).**
- **Re-run `milestone-doc-review`** — code changed since its last run (the earlier GAPS-FIXED is stale).
- **Commit** all this session's work (code + tests + docs) — the milestone restore point. Commit by explicit path; never `.env.local` or `test-results/`.
- **Re-run `milestone-prereqs` → READY**, log it in `AGENT_RUN_LOG.csv`, then declare M4 complete (report the agent + tech-debt review explicitly). The earlier GAPS-OPEN run is stale.
- **Optional:** eyeball the three fixes (click scale, trail alignment, scroll tint); decide whether to keep or revert the partial visibility change.

**Then M5 starts with the session-merge bug fix (first task), then the model-selector agent — both specced in `PRODUCT_OVERVIEW.md` → M5 scope.**

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
