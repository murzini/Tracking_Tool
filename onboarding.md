# Session Onboarding

Quick start for a new session. **Review and trim this file at the start of every session — rewrite it to the current state, don't pile new notes on top.** Keep only what the next session needs to act. Detail lives in the docs; this file points to them.

**Only "Current state" and "Next action" change each session — replace them. Everything else is stable structure; keep it.**

## What this project is

A heatmap product on a Next.js sandbox (Shop). It records visitor behaviour on the three checkout steps and shows it as overlays, to learn why people drop off. A POC, meant for later integration into Autohero.

**GitHub:** `https://github.com/murzini/Tracking_Tool` (main branch — source of truth)
**Vercel:** `https://tracking-tool-kappa.vercel.app` (auto-deploys on push to main)
**Workflow:** Clone once to `C:\Temp\Tracking_Tool` and keep it for the duration of M7. At the start of each part, run `git pull` to ensure the clone is current — do not rely on `git status` alone (it won't show remote changes without a fetch). Delete the folder only when M7 is fully closed. If the folder is missing, clone fresh from GitHub.

## Model selection

At the start of each task, I assess whether the current model tier is the best fit (see `.claude/agents/model-selector.md` for the 3-tier mapping: Opus = hard reasoning/architecture; Sonnet = everyday coding/agents; Haiku = mechanical tasks). 

**Behavior:** I emit a one-line verdict before proceeding to work:
- If the current model fits: `Model: <tier> OK — <reason>`
- If it doesn't fit: `Suggest /model <tier> — <reason>`

**Important:** I never shift the model implicitly (e.g., via subagent override or workaround). You control all transitions — you decide whether to switch the main session model. I prompt, you switch, I proceed.

**Enforcement hooks:** a `UserPromptSubmit` hook in `.claude/settings.json` injects the model-fit reminder on every prompt automatically. This is a safety net — the proactive one-line verdict is still required before any work.

See `CLAUDE.md` → "Model selection" for the full rule.

## Current state

- **M1–M6.2 CLOSED and signed off.** M6.2 closed 2026-05-28 (`b851547`): 54 unit tests + 73 e2e, all green. GitHub + Vercel live (`tracking-tool-kappa.vercel.app`, auto-deploys on push to `main`).
- **M7 milestone-start READY (2026-05-28).** Scope frozen, 9-part plan, 7 anticipated tech-debt items, test plan logged (`4954a4c`).
- **M7.1–M7.3 DONE (2026-05-28). 126 unit tests.** Each part extracted pure logic to its own module + unit tests (detail in `TEST_CASES.md` → M7):
  - M7.1: `captureWindowCheck.js` (`isCaptureWindowOpen`, 16 tests).
  - M7.2: `ingestConfigGates.js` (4 gates, 24 tests).
  - M7.3: full M1–M5 audit — `resumeRefMatch.js` (`isResumableRef`, 10), `exitReasonResolver.js` (`resolveExitReason`, 9), `scannerUtils.js` (`slugify`+`safeAttrSelector`, 13). All other M1–M5 code is either already tested, DOM-dependent, `Math.random`-dependent, or a thin API wrapper with no extractable pure logic — audit is complete, not partial.
- **M7 Part 4 DONE (2026-05-28). 148 unit tests total, all green. Latest commit `ed94dc8`.** Dashboard Report section rebuilt: min-sessions dropdown (100/200/500/1000), accumulated session count (fetched from query API on mount + after Save), Generate Report button disabled until gate met, dynamic note text. Report section moved before Simulation. Pure gate logic extracted to `lib/prototype/reportGateLogic.js` (`isReportGateMet`, `getGateNoteText`, `MIN_SESSIONS_OPTIONS`, `DEFAULT_MIN_SESSIONS`); 22 unit tests in `tests/unit/reportGateLogic.test.ts`. Committed and pushed — Vercel live.
- **M7 Part 5 DONE (2026-05-28). 224 unit tests total, all green.** 19 pure aggregation transforms extracted to `lib/prototype/reportAggregationTransforms.js`; 76 unit tests in `tests/unit/reportAggregationTransforms.test.ts`. Screenshot capture approach decided: **Playwright** (already in project, server-side, no client coordination, 10-15s fits 30-50s budget, token passed in URL). Commit pending.
- **M7 scope frozen (key decisions):**
  - **4-section report**: Intro & Methodology / Executive Summary / Step Analysis (per step, sub-sections A-E) / Conclusions (AI hypotheses).
  - **AI model**: Claude Opus 4.7 (`claude-opus-4-7`), single API call, structured JSON output → React components.
  - **Location**: dedicated `/dashboard/report?token=...` page.
  - **Generation UX**: progress bar (~30-50s expected).
  - **Min-sessions gate**: new dropdown (100/200/500/1000) in Report section + live accumulated count; Generate Report button disabled until threshold met.
  - **Report section moved** in dashboard: after Heatmap, before Simulation.
  - **Heatmap screenshots = real** — capture via **Playwright** (decided Part 5).
  - **Design principle**: every part extracts pure logic to its own module; React/SQL/API stay thin wrappers.
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

**Verify state before starting each part** (takes 30 seconds, avoids acting on stale info):
1. `git pull` — then `git log --oneline -3` to confirm you're on the latest commit (see Part 5 commit below).
2. Confirm files exist: `lib/prototype/reportAggregationTransforms.js`, `tests/unit/reportAggregationTransforms.test.ts`.
3. `npm install && npm run test:unit` — must print `224 passed` (or more if a prior part added tests).
If the clone is missing, clone fresh from GitHub.

## Next action

**Start M7 Part 6 (heatmap screenshot capture).** Implement server-side Playwright screenshot capture for each of the 3 checkout steps. Each screenshot visits `/checkout/[step]?token=...` with viewport set, waits for heatmap overlay to render, captures to buffer. Output: `{ step, screenshotBase64 }[]`. Extract pure screenshot-request builder (URL + viewport config) to `lib/prototype/reportScreenshotConfig.js`; unit tests in `tests/unit/reportScreenshotConfig.test.ts`. The Playwright execution itself lives in an API route or server action (not unit-testable). See `PRODUCT_OVERVIEW.md` → M7 → Part 6 and `TEST_CASES.md` → M7.

**M7 sequence:** ~~M7.1~~ → ~~M7.2~~ → ~~M7.3~~ → ~~Part 4~~ → ~~Part 5~~ → Part 6 (screenshots) → Part 7 (Opus integration) → Part 8 (real report page) → Part 9 (close). Full plan in `PRODUCT_OVERVIEW.md` → M7 → "M7 sequencing (parts)".

**Before Part 7:** add `ANTHROPIC_API_KEY` to `.env.local` and Vercel env vars (anticipated tech debt item).

## What to read first, in order

1. `Documentation/AGENTS.md` — working rules + agent catalogue. Governs how all work is done.
2. `Documentation/PRODUCT_OVERVIEW.md` → **M7** — frozen scope, 9-part plan, unit-testability principle, anticipated tech debt. Also "M7 unit-test surface" for the pure-module map.
3. `Documentation/TEST_CASES.md` → **M7** — Tests 64-68 (e2e) + M7.1/M7.2/M7.3 unit specs + new M7 code unit specs (`reportGateLogic`, `reportAggregationTransforms`, `reportPromptBuilder`, `reportResponseParser`).
4. `Documentation/ARCHITECTURE_OVERVIEW.md` — M6.2 unit test layer added. (M7 architecture detail will be added during implementation.)

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
- Suite runs single-worker; current green count lives in `TEST_CASES.md` → M6.2 (don't hardcode it here). **Don't run the suite while `npm run dev` is up** — shared port 3000 + `.next` cache corrupts the build. If wedged: stop all dev servers → delete `.next` → start one fresh. (Tip: don't start your own dev server on another port either — it shares `.next` and can wedge the runner.)
- Log every agent run in `Documentation/AGENT_RUN_LOG.csv` (append only).
- If tests change, update `TEST_CASES.md` + the `PRODUCT_OVERVIEW.md` test summary. If architecture changes, update `ARCHITECTURE_OVERVIEW.md`.
- Don't declare a milestone complete until `milestone-prereqs` returns READY.
- At checkpoints, suggest a new session and offer to refresh this file.
