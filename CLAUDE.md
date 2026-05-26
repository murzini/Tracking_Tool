# CLAUDE.md — Shop Sandbox heatmap project

## Start here
Read `onboarding.md` (repo root) first — it points to the current milestone, the current state, and which docs to read. `Documentation/AGENTS.md` holds the working rules that govern all work.

## Model selection (automatic)
At the start of each new task — and whenever the task type changes mid-session — assess whether the current model is the best fit, using the tier mapping in `.claude/agents/model-selector.md`.

- **Emit a one-line verdict before proceeding to work:** either `Model: <tier> OK — <reason>` if the current model fits, or `Suggest /model <tier> — <reason>` if it doesn't. This makes the assessment visible and prevents silent skips.
- Example (fits): `Model: Haiku OK — reading docs and editing config files.`
- Example (doesn't fit): `Suggest /model sonnet — multi-step feature work needs better reasoning.`
- **Never shift the model implicitly.** If a task needs a different tier, prompt with a one-line suggestion and wait for the user to switch manually. Do not route work to another tier via subagent override or other workarounds. The user controls all transitions.
- Apply the mapping inline (no subagent needed for the routine check). For a considered recommendation the user can invoke the `model-selector` agent explicitly.
- Hooks in `.claude/settings.json` reinforce this rule automatically: `UserPromptSubmit` injects a reminder each turn; `PreToolUse` on `Agent` shows a check before any subagent runs.
