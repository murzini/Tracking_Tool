# Ideas By Codex

## New agents

### Report Reliability Agent

Needed because report generation is the weakest flow now. It would watch timeout risk, prompt size, parse failures, retries, and output shape, then suggest safe fallbacks before users see broken reports.

Cost note: this should be mostly rule-based, not constantly calling Claude. Cheap version uses no Claude calls and only checks timeout length, prompt size, JSON shape, retries, and known failure patterns. Smarter version should call Claude only on demand, like after a failure, incomplete output, or deploy check. Best setup is "offline checks first, model last" to keep cost low.

### Config Consistency Agent

Needed because config state crosses dashboard, checkout, API, and SSR. It would check fresh-read vs cached-read paths, save/read drift, and places where one config change can silently break another page.

### Test Drift Agent

Needed because docs, test names, and real behavior can drift apart. It would compare `TEST_CASES.md`, onboarding notes, and actual Playwright files, then flag mismatches before confusion spreads.

### Release Gate Agent

Needed because this repo has many readiness docs and manual checks. It would run the documented gate, confirm required tests, missing debt signoff, env assumptions, and doc updates, then give one clear release verdict.

### Prompt Cost Agent

Needed because AI report quality and Claude cost are linked. It would track prompt length, token use, output size, and repeated calls, then propose cheaper prompt trims without changing report structure.

### Data Quality Agent

Needed because the product depends on event truth. It would inspect session data, event shapes, null rates, broken fields, and schema drift so bad tracking is caught before reports become misleading.

### Screenshot Health Agent

Needed because screenshot/demo paths are useful but less covered. It would verify capture success, image pairing, storage cleanup, and report screenshot readiness, especially after UI or browser-flow changes.

### Tech Debt Triage Agent

Needed because debt is documented well but spread across files. It would group debt by risk, age, and user impact, then turn known rough edges into a ranked worklist.

### Auth Surface Agent

Needed because the shared dashboard token is simple but weak. It would map every protected route, token use, leak risk, and bypass path, then show what must change before broader exposure.

### Doc Freshness Agent

Needed because documentation is strong but large. It would scan architecture, product, onboarding, and test docs after each major change, then flag stale sections and suggest exact lines to update.

## Tech debt

- Shared dashboard token auth is the biggest real product risk. Fine for POC, weak for real users, audits, and access control.
- No concurrent admin write safety. Two admins could save different config states and overwrite each other.
- Screenshot and demo paths still miss auto tests. Acceptable for demo work, but weak if those paths matter in real use.
- Real report generation is not auto-tested. Reasonable for now because cost and slowness are real.
- Report caching is deferred. Repeated AI calls will cost money and time.
- Visitor ID resets on each login. That weakens cross-session analysis.
- Visitor ID is not exposed in the query API. That limits analyst value and deeper behavior analysis.
- Thank-you page is not tracked. Non-critical now, but it blocks full funnel understanding later.
- Mouse-move data is stored raw. Okay for POC scale, likely too heavy at larger traffic.
- Sim schema migration burden is real. Every schema change now has more places to update.
- Sim data stays until manual discard. Small risk, but it can confuse users and pollute demos.
- Dashboard UI polish and accessibility are still shallow. Not dangerous, but it lowers trust and ease of use.
- Suite runtime growth is real debt. Valuable tests, but slow suites can reduce team speed over time.
- No app-health logging is worth tracking. Behavior data is strong, but crash and offline visibility are still weak.
- Tour mode adds scaffolding debt. Not harmful now, but it adds noise and can confuse future work.

## Logging and alerts

Yes, this project should have small structured logs and alerts for the few flows that matter most.

Start with these events:

- `report_generation_started`
- `report_generation_failed`
- `report_generation_succeeded`
- `report_parse_failed`
- `report_timeout`
- `report_auth_failed`
- `config_save_failed`
- `config_read_stale_or_mismatch`
- `screenshot_capture_failed`
- `db_query_failed`

For each event, log:

- timestamp
- route name
- environment
- source like `demo` or `live`
- request id
- short error code
- short human message
- duration in ms
- safe context like step count or payload size
- no sensitive user data

For report failures, capture:

- DB aggregation time
- Claude call time
- total request time
- HTTP status
- timeout vs parse failure vs auth failure
- response was JSON or plain text
- prompt size and response size

Start alerts with:

- any `report_generation_failed` after deploy
- more than `3` report failures in `15` minutes
- any timeout spike
- parse failure rate above a small threshold
- screenshot failure spike
- repeated auth failures if that may mean abuse or broken links

Recommended setup:

- start simple with structured logs plus email or Slack alerts
- a good next step is Sentry for errors plus structured logs
- keep it small, focused, and cheap first
