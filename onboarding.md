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
- **M5 — Login Step and Individual Session Attribution** — IN PROGRESS. Parts 1 + 2 done and manually verified. Part 3 (tests + close gates) not yet started.
  - **Part 1 — DONE (2026-05-26).** Schema migration (`visitor_id TEXT` on both schemas), login step UI in `CheckoutFlow.jsx`, `?step=login` as checkout entry, heatmap capture disabled on login. Manual check passed.
  - **Part 2 — DONE (2026-05-26).** `lib/prototype/checkoutVisitorId.js` (`mintVisitorId` / `getVisitorId` / `isLoginDone`). UUID minted on login Continue → localStorage + sessionStorage gate. `resolveStep` blocks checkout steps without gate. `visitor_id` on every session payload, written to DB (COALESCE upsert), round-tripped through normalize + rowToSession. `DATA.md` updated. Manual check passed.
  - Earlier work: session-merge bug fix (54/54 green), model-selector agent, login step spec fully specified, anticipated tech debt recorded, architecture + 3-part plan documented, `milestone-test-planning` OK, `milestone-start` READY — all logged in `AGENT_RUN_LOG.csv`.
- **Still deferred to the user:** the `PRODUCT_OVERVIEW.md` structural split.
- **Note (don't "fix"):** an `in-progress` session may show an `exit_reason` (e.g. `left-browser`) — INTENDED. See `DATA.md` → `exit_reason`.

## Next action

**Start Part 3 — Tests + close gates.**

- Update existing full-flow helpers in test specs to navigate through the login step (~47 tests affected per `milestone-test-planning`).
- Add 4 new tests (Tests 45–48): login step renders; empty name blocks; valid name advances to PI; `visitor_id` written to localStorage; subsequent sessions carry same `visitor_id`; new login mints new `visitor_id`.
- Run full suite via `scripts/run-playwright-isolated.ps1` → all green.
- Run close gates: `milestone-doc-review`, tech-debt review, agent review, `FUTURE_THIRD_PARTY_INTEGRATION.md` review, `milestone-prereqs` → READY.
- Commit.

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
