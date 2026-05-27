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
- **M6 — Admin Dashboard — SCOPING (no code yet; scope + plan now done).** Scope **fully specified** in `PRODUCT_OVERVIEW.md` → M6 → **"Decisions agreed (2026-05-27)"**; anticipated tech debt there too ("Anticipated (M6)"). **NEW this session (2026-05-27):** the **M6 architecture section** is written in `ARCHITECTURE_OVERVIEW.md` → "M6 architecture — admin dashboard" (route + auth, config store, capture gating, outcome unification, viewer filters, header removal, files, **6-part implementation plan**), and the **M6 implementation flow** is written in `PRODUCT_OVERVIEW.md` → M6 → "Implementation flow".
  - **Config-storage decision (made this session, flag if you disagree):** runtime config lives in a **single-row Postgres `heatmap_config` table** (recommended over JSON/in-memory — see `ARCHITECTURE_OVERVIEW.md` → M6 → "Config storage decision"). This downgrades the anticipated "ephemeral config" debt.
  - **Key decisions:** secret-link auth (one shared env `DASHBOARD_TOKEN`; rotate to revoke). Single-page dashboard, sections **Data → Heatmap → Report**, narrow/centered, **desktop-only**, styled like the Shop. **Data** = 8 config items + **Save** (toggles for steps / element-types / event-types / sampling actually start/stop **live capture** on Save; clear-data is immediate behind its own pop-up, wipes ALL data). Sampling presets 1/10/50/75/100%. **Heatmap** = filters → button opens the heatmap in a **new tab** (URL params; no Save). **Outcome filter** = drop-offs / completers / all (incl. `in-progress`). Raw-data export **dropped**. Report = **placeholder** (real report is M7). Single-choice = dropdowns; desktop/mobile = icons; heatmap icon with **breathing** dots.
  - **Two M6 tasks that touch BUILT code + tests:** (1) **Unify the outcome model** — collapse `advanced` + `completed` into a single `completed`, drop `advanced`, relabel existing DB rows, update tests + docs. (2) **Remove the Shop header buttons** (Heatmap, Clear data, view toggles) — delete from the Shop UI; they live only in the dashboard. Tests that click them (Tests 2/3) need a new path; Test 37 asserts `advanced` → must become `completed`.
- **M6.1 — Heatmap Simulation Mode — FOLLOW-UP TO M6 (do AFTER M6, BEFORE M7).** Recorded 2026-05-27 in `PRODUCT_OVERVIEW.md` → "M6.1". An admin dashboard sim that generates ~1500 realistic-mix random sessions on the Personal Info step (desktop + mobile, all 3 views), stored **separate** from real data and **discardable without touching real data**. Decision so far: **realistic mix** (not pure random). **Not scope-frozen** — needs its own `milestone-start`; parked open questions are listed under M6.1. **Don't skip from M6 straight to M7.**
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**M6 `milestone-start` prerequisites — scope, anticipated tech debt, AND architecture + phased plan are now DONE. Two left before code:**

1. **Test plan** — run **`milestone-test-planning`** for M6. It must account for the two built-code tasks (outcome rename breaks **Test 37**; header-button removal breaks **Tests 2/3**) plus new coverage: dashboard auth, config Save → capture starts/stops, clear-data confirm, outcome filter, timeframe view-window, public config `GET` defaults. (Known impacts are listed in `ARCHITECTURE_OVERVIEW.md` → M6 → "Known test impacts".)
2. Then run **`milestone-start`** → must return **READY** before any code.

Then **implement M6** in the 6 parts in `ARCHITECTURE_OVERVIEW.md` → M6 → "Implementation plan" (outcome rename first → … → header removal last, so the suite stays green).

**After M6 closes: scope + build M6.1 (Heatmap Simulation Mode) BEFORE M7.** Run its own `milestone-start`; raise the parked open questions (under `PRODUCT_OVERVIEW.md` → M6.1) at that point.

- Current suite baseline: **58/58 active tests passing** (see `TEST_CASES.md`).
- **Heads-up: this session's doc edits (`ARCHITECTURE_OVERVIEW.md`, `PRODUCT_OVERVIEW.md`, `onboarding.md`) are doc-only and uncommitted** — commit them as the restore point at session start. No code changed, so the suite is still 58/58.

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
