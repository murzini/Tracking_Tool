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

- **M1–M5 COMPLETE and signed off.** M5 (Login Step + Visitor Attribution) closed 2026-05-26; **58/58 active tests passing.** Per-milestone detail lives in `PRODUCT_OVERVIEW.md`.
- **M6 — Admin Dashboard — SCOPING (in progress; no code yet).** Scope is **fully specified and recorded** (2026-05-27) in `PRODUCT_OVERVIEW.md` → M6 → **"Decisions agreed (2026-05-27)"**. Anticipated tech debt drafted there too (see "Anticipated (M6)", 7 items).
  - **Key decisions:** secret-link auth (one shared env token; rotate to revoke). Single-page dashboard, sections **Data → Heatmap → Report**, narrow/centered, **desktop-only**, styled like the Shop. **Data** section = 8 config items + a **Save** button (toggles for steps / element-types / event-types / sampling actually start/stop **live capture** on Save; clear-data is immediate behind its own pop-up and wipes ALL data). Sampling presets 1/10/50/75/100% (random sticky per-visitor — already built, M4). **Heatmap** section = filters → button opens the configured heatmap in a **new tab** (URL params; no Save). **Outcome filter** = dropdown drop-offs / completers / all (all incl. `in-progress`). Raw-data export **dropped** (BE queries DB directly). Report = **placeholder** button (real report is M7). Single-choice selects = dropdowns; desktop/mobile = icons; heatmap icon with **breathing** dots.
  - **Two M6 tasks that touch BUILT code + tests (not just docs):** (1) **Unify the outcome model** — collapse `advanced` + `completed` into a single `completed` ("completed this step"), drop `advanced`, relabel existing DB rows, update tests + `DATA.md`/`ARCHITECTURE_OVERVIEW.md`. (2) **Remove the Shop header buttons** (Heatmap, Clear data, view toggles) — delete from the Shop UI; they live only in the dashboard, never shown to visitors. Existing tests that click those buttons (open heatmap / clear data) need a new path.
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**Finish the remaining M6 `milestone-start` prerequisites — scope + anticipated tech debt are DONE; two left:**

1. **Architecture + phased implementation plan** — write the M6 section in `ARCHITECTURE_OVERVIEW.md` (and the M6 implementation flow in `PRODUCT_OVERVIEW.md`). Must cover: dashboard route + auth gate, runtime config storage for the toggles, the outcome-model unification, and the Shop header-button removal.
2. **Test plan** — run **`milestone-test-planning`** for M6. It must account for the two code tasks above (outcome rename + header-button removal will break existing tests) plus new dashboard/auth/config/outcome-filter coverage.
3. Then run **`milestone-start`** → must return **READY** before any code.

- Current suite baseline: **58/58 active tests passing** (see `TEST_CASES.md`).
- **Heads-up: this session's doc edits (PRODUCT_OVERVIEW.md, AGENT_RUN_LOG.csv, onboarding.md) are doc-only and may be uncommitted** — commit them as the restore point at session start. No code changed, so the suite is still 58/58.

## What to read first, in order

**Essential — read before M6 work:**
1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` → M6 scope — Admin Dashboard spec.
3. `Documentation/TEST_CASES.md` → M5 — current green count is 58/58.
4. `Documentation/ARCHITECTURE_OVERVIEW.md` → M5 for login/session context; M4 for session lifecycle.

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
