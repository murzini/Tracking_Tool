# Session Onboarding

Quick start for a new session. **Review and trim this file at the start of every session — rewrite it to the current state, don't pile new notes on top.** Keep only what the next session needs to act. Detail lives in the docs; this file points to them.

**Only "Current state" and "Next action" change each session — replace them. Everything else is stable structure; keep it.**

## What this project is

A heatmap product on a Next.js sandbox (Shop). It records visitor behaviour on the three checkout steps and shows it as overlays, to learn why people drop off. A POC, meant for later integration into Autohero.

**Local repo:** `C:\My AI Projects\M0`

## Current state

- **M1, M2, M3** — COMPLETE and signed off.
- **M4 — Extended Interaction Capture** — IN PROGRESS. Scope FROZEN. **Parts 1–7 done. Part 8 port (Chunks A–F) DONE (2026-05-25) — suite 53/53 green.**
- **Part 8 rendering is now implemented** (in `app/checkout/[sku]/heatmap/page.jsx`; click dots also in `components/prototype/shopRuntime.js`; note slot in `components/prototype/TopBar.jsx`):
  - **Clicks** = precise per-element dots, red **alpha by count** (`clickDotAlpha`, 0.2→0.8). Positions/radius unchanged → 10px precision tests still valid.
  - **Mouse-move** = **trails** at a **volume-aware** stroke alpha (`trailStrokeAlpha`: ~0.5 at low volume → ~0.06 at ~1000 trails).
  - **Scroll** = **green** colour-by-depth translucent tint + inline "<n>% saw it" legend.
  - **Floating-elements note** (moves view): yellow, ~30% smaller, right of the shop logo, via an optional `ShopFrame`/`TopBar` slot the heatmap page fills (live shop untouched). Desktop vs mobile wording; mobile stacks below the finger disclaimer.
  - **Removed:** density + fold-line overlays, the whole `?style=` toggle (`StyleLink`/`hasStyleChoice`/`readLayerStyle`), the temp `?nv=` code, and the three sim pages + `.sim-shots/`.
  - Full detail: `PRODUCT_OVERVIEW.md` → M4 Part 8 + `ARCHITECTURE_OVERVIEW.md` → M4 Part 8 (PORT STATUS).
- **Tests:** 53/53 green via the isolated runner. Rendering Tests 39/40/43 rewritten for the single-style views + hardened so a stray funnel bounce can't flake them (find the session by its events, not by count).
- **NOT committed yet:** all Chunk A–F code + these doc updates are uncommitted, by request — commit once manually tested.
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED ("left, not finalized, may return within X"). See `DATA.md` → `exit_reason`.

## Next action

**M4 close — the Part 8 rendering port (Chunks A–F) is done and the suite is 53/53.** What remains, in order:

- **Doc-trim pass (structural — NOT done yet).** `ARCHITECTURE_OVERVIEW.md` → M4 Part 8 lists the fixes: reorder `DATA.md` so the live Postgres schema leads (demote the M1 JSON schema to a historical appendix); reframe the M1-era sections in `ARCHITECTURE_OVERVIEW.md` + `FUTURE_THIRD_PARTY_INTEGRATION.md`; split active scope from settled-decision history in `PRODUCT_OVERVIEW.md`. (`milestone-doc-review` catches only factual gaps, not structure — do this pass first.)
- **2 critical tech-debt items (must close before M4).** Event-delivery reliability (no dropped events on tab close / nav) + event-volume vs the Neon free tier. See `PRODUCT_OVERVIEW.md` → Tech Debt → Critical.
- **Close gates.** `milestone-doc-review`, tech-debt review, `FUTURE_THIRD_PARTY_INTEGRATION.md` + `DATA.md` review, agent review, then `milestone-prereqs` → READY.
- **Commit.** Chunks A–F + the doc updates are uncommitted by request — commit once the user has manually tested the ported heatmap.

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
