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

- **M1–M6 COMPLETE and signed off.** M6 (Admin Dashboard) closed 2026-05-27. All 6 parts done; 66/66 tests green. Per-milestone detail lives in `PRODUCT_OVERVIEW.md`.
  - P6 delivered: `TopBar` `showM1Actions` block (Heatmap dropdown + Clear-data button) deleted; `ShopFrame` `topBarRight` prop replaces `heatmapHref`; viewer stats moved to `topBarRight`; in-viewer type/view toggle buttons removed; Tests 2/3 rewritten to dashboard path; `data-heatmap-step-label` + `data-heatmap-stats` attributes added.
- **M6.1 — Heatmap Simulation Mode — FOLLOW-UP TO M6 (do AFTER M6, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.1". Not scope-frozen; needs its own `milestone-start`.
- **M6.2 — Unit Test Foundation — FOLLOW-UP TO M6 (do AFTER M6.1, BEFORE M7).** Recorded in `PRODUCT_OVERVIEW.md` → "M6.2". Add a Vitest unit-test layer over the durable pure-logic core (heatmap normalize/finalize/drop-off/timing, **sampling, capture window**, config defaults, scanner) — targeted, not blanket. Both P3/P4 bugs were exactly that kind of pure-logic bug e2e missed. Not scope-frozen; needs its own `milestone-start`. **Don't skip from M6 straight to M7 — sequence is M6 → M6.1 → M6.2 → M7.**
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**Start M6.1 (Heatmap Simulation Mode) or M6.2 (Unit Test Foundation)** — run `milestone-start` against the chosen next milestone. Both are recorded in `PRODUCT_OVERVIEW.md`. M6.1 first per the documented sequence.

Pre-requisite: `milestone-prereqs` returns READY.

## What to read first, in order

1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` — M6 closed; M6.1/M6.2 scope notes in "Future Milestones".
3. `Documentation/TEST_CASES.md` → M6 — 66 tests; P6 existing-test updates documented.
4. `Documentation/ARCHITECTURE_OVERVIEW.md` — M6 architecture CLOSED.

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
- Suite runs single-worker; current green count lives in `TEST_CASES.md` → M4 (don't hardcode it here). **Don't run the suite while `npm run dev` is up** — shared port 3000 + `.next` cache corrupts the build. If wedged: stop all dev servers → delete `.next` → start one fresh. (Tip: don't start your own dev server on another port either — it shares `.next` and can wedge the runner.)
- Log every agent run in `Documentation/AGENT_RUN_LOG.csv` (append only).
- If tests change, update `TEST_CASES.md` + the `PRODUCT_OVERVIEW.md` test summary. If architecture changes, update `ARCHITECTURE_OVERVIEW.md`.
- Don't declare a milestone complete until `milestone-prereqs` returns READY.
- At checkpoints, suggest a new session and offer to refresh this file.
