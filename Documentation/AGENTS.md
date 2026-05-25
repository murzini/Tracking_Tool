# Agents

This document is the single source of truth for all agent-related information: working rules, philosophy, and the catalogue of available agents.

Read `Documentation/PRODUCT_OVERVIEW.md` before making product decisions or implementation changes.

> **Source of truth for the working rules.** The completion and milestone-start **working rules** are authoritative *here* in `AGENTS.md`. `PRODUCT_OVERVIEW.md` carries a convenience copy in its "Working rules" section; if the two ever diverge, **this file wins** — change a rule here first, then reconcile the mirror. (The Tech Debt register and milestone scope, by contrast, live authoritatively in `PRODUCT_OVERVIEW.md`.)

## Philosophy
- Agents support repeatable quality work around implementation, testing, and regression handling.
- The main benefits are better consistency, faster review of likely test impact, clearer regression triage, and stronger coverage of precision-sensitive behavior.
- Agent definitions are added or refined toward the end of each milestone, once scope and workflows are stable enough to define clearly.
- Agent definitions must evolve together with the product, tests, and milestone scope.
- Responsibility for adding, updating, and deprecating agents belongs to the implementation workflow and is handled as part of normal delivery work.

## Agent catalogue

Agent definitions live in `.claude/agents/`. All agents must be reviewed at the end of each milestone to determine whether they remain valid, need updating, or should be deprecated.

- **`test-impact`** (`test-impact.md`)
  - **What it does**: Given a description of a planned change and/or a list of files being modified, identifies which tests may be affected and recommends the minimum set to run.
  - **Why it exists**: The suite has tests across multiple spec files covering different layers. Without impact analysis it is easy to run too few tests and miss a regression, or run all tests when only one is relevant.
  - **When to use**: Before implementing any change that touches covered code.

- **`regression-triage`** (`regression-triage.md`)
  - **What it does**: Given a failing test name, error output, and a description of the recent change, determines whether the failure is a real regression or an outdated test.
  - **Why it exists**: A failing test has two very different meanings and the wrong response to each is costly — shipping a bug versus wasting time fixing working code.
  - **When to use**: Any time a test fails after a change.

- **`heatmap-qa`** (`heatmap-qa.md`)
  - **What it does**: After a change to heatmap-related code, reviews the full capture-to-rendering pipeline and flags any behaviors at risk. States which tests to run and calls out anything that looks wrong before the tests run.
  - **Why it exists**: The heatmap has several precision-sensitive moving parts (anchor resolution, radius scaling, view classification, fixed-position overlay). A change to one part can silently break another.
  - **When to use**: After any change to `checkoutHeatmapClient.js`, `checkoutHeatmap.js`, `checkoutHeatmapRegistry.js`, the heatmap page, the API route, or `CheckoutFlow.jsx`.

- **`anchor-registry`** (`anchor-registry.md`) — **DEPRECATED in M2.** Superseded by the auto-discovery scanner.
  - **What it did**: Audited and maintained the sync between `data-heatmap-id` attributes in `CheckoutFlow.jsx` and entries in the manual `PERSONAL_INFO_ELEMENT_REGISTRY`.
  - **Why deprecated**: M2 replaced the manual registry with `checkoutScanner.js` (live DOM discovery is the source of truth). The snapshot (`CHECKOUT_ELEMENT_REGISTRY`) is auto-maintained and its parity is enforced automatically by Test 11 across all steps. Use `heatmap-qa` for element/render concerns instead.
  - **When to use**: Do not use for new work; retained only as a historical record.

- **`milestone-test-planning`** (`milestone-test-planning.md`)
  - **What it does**: Given the scope of a new milestone, reviews the existing test suite and produces a test plan: tests to keep, update, remove, and new cases to write.
  - **Why it exists**: Starting a milestone without a structured test review leads to missed coverage gaps or stale tests carried forward.
  - **When to use**: At the start of every new milestone, before any implementation work begins.

- **`milestone-doc-review`** (`milestone-doc-review.md`)
  - **What it does**: Reads all core documents (discovered from `Documentation/` plus the root `README.md`/`ONBOARDING.md`) against the actual code and test files, and produces a gap report listing anything stale, missing, or inconsistent. Includes a reference-resolution check over the agent definitions themselves.
  - **Why it exists**: Doc updates can be missed during implementation. This is the end-of-milestone safety net before the milestone is closed.
  - **When to use**: At the end of every milestone, after all implementation and agent reviews are complete.

- **`milestone-prereqs`** (`milestone-prereqs.md`)
  - **What it does**: Checks all mandatory prerequisites from the completion checklist against `AGENT_RUN_LOG.csv` and project state, and returns a READY / NOT READY verdict.
  - **Why it exists**: Ensures no mandatory step is skipped before a milestone is declared complete.
  - **When to use**: As the final step before declaring a milestone complete.

- **`milestone-start`** (`milestone-start.md`)
  - **What it does**: Checks all mandatory prerequisites for starting a new milestone — previous milestone closed, scope frozen and fully specified, tech debt reviewed, architecture and implementation plan documented, test plan produced. Returns a READY / NOT READY verdict with the exact gaps listed.
  - **Why it exists**: Ensures implementation does not begin until all unknowns are resolved and the team has a clear plan, preventing ad-hoc decisions and unplanned tech debt.
  - **When to use**: Before any implementation work on a new milestone begins.



## Starting a milestone

A milestone must not begin implementation until all of the following are satisfied:

1. **Previous milestone closed** — `milestone-prereqs` logged `OK` or `GAPS-FIXED` for the previous milestone in `AGENT_RUN_LOG.csv`.
2. **Scope frozen** — what is being built is agreed, documented in `PRODUCT_OVERVIEW.md`, and no new features will be added mid-milestone.
3. **Scope specified** — all open implementation questions are answered. The spec must be detailed enough that a developer can begin without guessing. "Scope frozen" and "scope specified" are not the same thing.
4. **Inherited tech debt reviewed** — carry-over tech debt from the previous milestone is acknowledged, prioritized, and recorded in the Tech Debt section of `PRODUCT_OVERVIEW.md`.
5. **Anticipated tech debt identified** — tech debt the new milestone is likely to introduce has been identified upfront and planned for, so implementation decisions can account for it.
6. **Architecture and implementation plan documented** — what changes, what new files/modules are introduced, what existing code is touched, and in what sequence things will be built.
7. **Test plan produced** — `milestone-test-planning` agent has been run and logged.

A milestone is not considered started until `milestone-start` has been run and returned a READY verdict.

## Session management

- After each significant checkpoint, explicitly tell the user this is a good point to start a new session. Significant checkpoints are: milestone closed, scope frozen, major documentation update, architecture decision made.
- The reason: long conversations degrade response quality even with compression. Documentation is the source of truth — a fresh session reading the core docs picks up exactly where the previous one left off.
- When suggesting a new session, ask the user: "Would you like me to update ONBOARDING.md before you start the new session?" If yes, update it to reflect the current state before the session ends.
- `ONBOARDING.md` must also be reviewed and updated by the `milestone-doc-review` agent at the end of every milestone.

## Completion and testing

- Any implementation that may affect an existing covered behavior must run the relevant automated test suite before it is considered complete.
- A change is not considered complete until the relevant automated tests are green.
- If any relevant automated test fails, that failure must be reported explicitly and the task is not considered complete.
- If automated tests were not run, that must be reported explicitly in the final response.
- If the only change is documentation, automated tests do not need to be run.
- If automated test cases are added, removed, or changed, the respective documentation must be updated accordingly.
- If architecture changes in a meaningful way, `Documentation/ARCHITECTURE_OVERVIEW.md` must be reviewed and updated accordingly.
- At the end of each milestone, agent needs must be reviewed.
- If scope, tests, or workflows changed, relevant agents must be added, updated, or deprecated.
- A milestone is not considered complete until this agent review has been done and reported explicitly.
- At the end of each milestone, `Documentation/FUTURE_THIRD_PARTY_INTEGRATION.md` must be reviewed and updated accordingly.
- **Tech-debt review is a completion gate.** At the end of each milestone the Tech Debt register in `PRODUCT_OVERVIEW.md` must record **all** debt introduced during the milestone (critical **and** non-critical) and strike resolved items; **every critical item must be resolved** before the milestone is complete. New or undocumented debt is detected by `milestone-doc-review` (its undocumented tech-debt scan) and enforced at close by `milestone-prereqs`. A milestone is not complete until this review is done and reported explicitly.
- **Commit is a milestone-finalize gate.** A milestone is not considered complete until all of its work (code, tests, and docs) is committed to git — the commit is the milestone's restore point. `milestone-prereqs` verifies a committed/clean tree before returning READY. Commit by explicit path (not a blanket `git add -A`) so secrets (`.env.local`, which holds the Neon `DATABASE_URL`) and generated files (`test-results/`) are never committed.
- **Recommended commit cadence (not just at milestone end):** also commit per part/chunk and per working session, so work is never more than one bad edit away from a restore point. This is a recommendation; the per-milestone commit is the hard gate.
- These rules apply to milestone work, fixes, refactors, and any other change that may impact covered scope.
