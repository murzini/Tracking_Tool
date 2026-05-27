# Shop Sandbox

## Documentation

| Document | Summary |
|---|---|
| **PRODUCT_OVERVIEW.md** | Primary reference. Product vision, milestone scope, working rules, testing framework summary, agent definitions, and tech debt register. |
| **ARCHITECTURE_OVERVIEW.md** | Technical reference. System architecture, data flow from capture to rendering, primary file boundaries, configurable rules, and architecture-level tech debt. |
| **FUTURE_THIRD_PARTY_INTEGRATION.md** | Integration reference. Stable data models, API contracts, embedding architecture, scan-new-page process, and configurable rules. Updated at each milestone. |
| **TEST_CASES.md** | Full test case specifications per milestone: steps, inputs, outputs, and evidence paths. Reviewed and updated at each milestone transition. |
| **AGENTS.md** | Claude agent rules. Instructs Claude to read PRODUCT_OVERVIEW.md before decisions and enforces working rules for completion and testing. |
| **DATA.md** | Data reference. Storage approach (current local JSON, future Vercel Postgres), canonical session and click schemas, store file format, and schema evolution per milestone. |
| **AGENT_RUN_LOG.csv** | Audit trail. One row per agent run: date, time (24h local, when the run finished), agent name, status, and summary. Never edited or deleted. |
| **README.md** *(repo root)* | Setup instructions, environment variables, heatmap API routes, and test run commands. Lives in repo root for GitHub display. |

## Current state (at a glance)

*Quick orientation so the live state isn't buried in the decision log below. For session-to-session continuity, see the repo-root `onboarding.md`.*

- **Last closed: M6.2 — Unit Test Foundation (2026-05-28).** 54 Vitest unit tests across 4 files, all passing. No e2e changes. Full detail: the **M6.2** subsection under Future Milestones.
- **Active: none.** Next milestone is M7 (AI-powered report).
- **Closed milestones:** M1 (Personal Information heatmap), M2 (full checkout coverage + auto-discovery scanner), M3 (Postgres store + query API), M4 (Extended Interaction Capture), M5 (Login Step and Individual Session Attribution), M6 (Admin Dashboard). Their sections below are settled history — recorded for context, not active scope; don't re-litigate.
- **Where things live in this doc:** most recently closed scope → the **M6** section; settled per-milestone decisions → the **M1–M6** sections (history, marked `STATUS: CLOSED`); cross-cutting debt → the **Tech Debt** register; not-yet-started work → **Future Milestones** M6.1–M8; speculative ideas → **Potential post-MVP items**.
- **This is an append-only decision log** — later dated notes can supersede earlier ones in place. When two notes seem to conflict, the most recent dated note and the current code win.

## Current Shop
The current Shop is a standalone Next.js sandbox that simulates the landing, search, details, checkout, and thank-you flow. It is our controlled test environment where we will build and validate this product before moving toward broader usage.

## Product POC
The problem is that visitors abandon checkout, but we do not have enough evidence to understand why they leave. Session-recording tools capture only a small sample, and manual review does not scale, so friction, hesitation, and confusing UI elements stay hidden. This POC will record visitor interactions across the checkout flow at much broader coverage, turn those signals into heatmaps and behavioral patterns, and generate actionable recommendations plus testable hypotheses to improve conversion. If the POC proves valuable, it can later be integrated into a real production product.

## Scope
- We are building a product to understand why visitors drop off during checkout by capturing behavior at a much broader scale than traditional session-recording tools.
- The first core capability is interaction capture and heatmap visualization. The system should record behaviors such as clicks, mouse movement, scrolling, validation triggers, and similar checkout interactions, then present them as heatmaps for both desktop and mobile views.
- The second capability is raw data access. All captured events should be stored in a database, and an admin user should be able to export that underlying data for further analysis.
- The third capability is AI-powered reporting. The product should analyze drop-off data from the database and generate conclusions, recommendations, and testable hypotheses aimed at improving checkout conversion.
- The fourth capability is an admin dashboard. Through it, an admin should configure what data is captured, on which screens, during which timeframes, and which event types are recorded. The same dashboard should also provide access to heatmaps, raw data export, and report generation.
- The fifth requirement is quality protection. The product should include test coverage and an automation framework to reduce regressions and keep instrumentation reliable.
- If the POC proves successful and stable, the product should later be prepared for integration into real products such as Autohero.


## Working rules
- Any implementation that may affect an existing covered behavior must run the relevant automated test suite before it is considered complete.
- A change is not considered complete until the relevant automated tests are green.
- If any relevant automated test fails, that failure must be reported explicitly and the task is not considered complete.
- If automated tests were not run, that must be reported explicitly in the final response.
- If the only change is documentation, automated tests do not need to be run.
- If automated test cases are added, removed, or changed, the respective documentation in this file must be updated accordingly.
- If architecture changes in a meaningful way, `ARCHITECTURE_OVERVIEW.md` must be reviewed and updated accordingly.
- If the scope of the current milestone changes during a conversation, ask whether `PRODUCT_OVERVIEW.md` needs updating before moving on.
- If a future integration topic is discussed or a decision is made about integration behavior, ask whether `FUTURE_THIRD_PARTY_INTEGRATION.md` needs updating before moving on.
- At the end of each milestone, agent needs must be reviewed.
- If scope, tests, or workflows changed, relevant agents must be added, updated, or deprecated.
- A milestone is not considered complete until this agent review has been done and reported explicitly.
- At the end of each milestone, `FUTURE_THIRD_PARTY_INTEGRATION.md` must be reviewed and updated accordingly.
- At the end of each milestone, the Tech Debt section must be reviewed and updated: new debt introduced during the milestone must be recorded, and any debt that was resolved must be removed.
- Any tech debt item classified as critical must be resolved before the milestone is considered complete.
- A milestone is not considered complete until the Tech Debt review has been done, all critical items have been resolved, and this has been reported explicitly.
- **A milestone is not considered complete until all of its work (code, tests, docs) is committed to git.** The commit is the milestone's restore point; `milestone-prereqs` verifies a committed/clean tree before returning READY. Stage by explicit path (not a blanket `git add -A`) so secrets (`.env.local`) and generated files (`test-results/`) are never committed. Committing per part/chunk and per working session is also recommended (the per-milestone commit is the hard gate).
- These rules apply to milestone work, fixes, refactors, and any other change that may impact covered scope.

## Automated testing
- From M6.2: two layers — **unit tests** (Vitest, `tests/unit/*.test.ts`, Node environment, no DB or dev server) and **e2e tests** (Playwright, `tests/e2e/*.spec.ts`, against `localhost:3000`). Unit tests run first; e2e runs after. See `AGENTS.md` → "Unit + e2e test workflow".
- Each milestone has a Playwright regression suite covering its agreed scope, running against `localhost:3000`.
- Test cases are product assets — they are reviewed at the start of every milestone, updated to reflect scope changes, and must be green before a milestone is considered complete.
- Full test case specifications (steps, inputs, outputs, evidence paths) live in `TEST_CASES.md`.
- M1: 11 test cases across 3 spec files — capture, drop-off, clear data, view separation, aggregation, layout, dot precision, radius scaling, registry–DOM sync.

## Agents
Agent philosophy, working rules, and the full catalogue of available agents live in `Documentation/AGENTS.md`.


## Tech Debt

### Critical
- ~~**No automated enforcement of registry sync.**~~ **Resolved in M1.** Test 11 enforces the invariant automatically: it renders the heatmap page, reads all `data-heatmap-id` attributes from the live DOM, and asserts both directions against the active registry entries. Runs as part of the standard M1 suite.
- ~~**Mixed session formats in storage.**~~ **Resolved in M1.** The renderer now skips any click without a valid `anchor.id` rather than attempting to render it using old coordinate data. Pre-anchor sessions produce no dots instead of incorrectly placed ones.
- ~~**Test suite will depend on a live database (anticipated, M3).**~~ **Resolved in M3 Part 1.** Tests run against a dedicated `heatmap_test` Postgres schema, selected via `HEATMAP_DB_SCHEMA` (set by the isolated runner `scripts/run-playwright-isolated.ps1`), so the suite never touches the `public` production data. 32/32 green on Postgres confirms isolation works.
- ~~**DB credentials / connection-string handling (anticipated, M3).**~~ **Resolved in M3 Part 1.** `DATABASE_URL` lives in `.env.local`; `.gitignore` excludes `.env`, `.env.*`, and `.env.local`; `.env.example` carries only a placeholder with a "never commit the real value" note.
- ~~**Agent definitions are stale and milestone-locked.**~~ **Resolved in M3 Part 5.** The five non-deprecated agents that hardcoded file/test/doc lists (`milestone-test-planning`, `milestone-doc-review`, `test-impact`, `heatmap-qa`, `regression-triage`) were rewritten to be discovery-based: read every `tests/e2e/*.spec.ts`, resolve the active milestone from `PRODUCT_OVERVIEW.md`, and review every doc in `Documentation/`. A **reference-resolution check** was added to `milestone-doc-review` (item 10) so future stale file/doc/function references in agent definitions are caught automatically. (`milestone-prereqs`/`milestone-start` were already milestone-agnostic; `anchor-registry` remains deprecated/historical.)
- ~~**Event-delivery reliability (anticipated, M4).**~~ **Resolved — verified at M4 close (2026-05-25).** Delivery is idempotent and multi-pathed, so no event is silently lost in normal operation: events stream to `/ingest` via interval (5 s) + size (50) flushes using a `keepalive` fetch during the session, and `pagehide` / `visibilitychange→hidden` fire a `sendBeacon` that commits the **whole** session — all events (incl. field/visibility events that aren't on the live buffer) and even a zero-interaction bounce. The server is idempotent: events insert `ON CONFLICT (id) DO NOTHING`, and the session upsert COALESCE/GREATEST-protects `finalized_at`/`outcome`/counts, so re-delivery (the beacon re-sending already-flushed events) never dupes or erases a finalized result. Verified by **Test 29** (batched `/ingest` delivery; client makes no legacy POST; buffered events survive a `pagehide` close via `sendBeacon` and land in the store). **Residual (tracked, bounded, not blocking):** a `sendBeacon` is capped at ~64 KB, so a *very long* session whose full events payload exceeds the cap can drop the tail not yet delivered by an interval/size flush (≤5 s / ≤50 events) — see "Beacon payload size cap" below. App-crash / offline exits leave nothing to beacon (fall back to `idle`/`left-browser`) — see the logging/observability item. Both are inherent and out of M4 scope.
- ~~**High-frequency event volume vs the test gate + free tier (anticipated, M4).**~~ **Resolved — verified at M4 close (2026-05-25).** Per-session volume is bounded by time-based throttles (mouse-move / finger-move ~100 ms ≈ 10 Hz; scroll ~100 ms and only on a depth change). **Test gate:** each test clears its data first (`DELETE`), and a guarded post-suite teardown (`tests/global-teardown.ts`) `TRUNCATE`s the `heatmap_test` schema (and *only* that schema — never `public`), so test data never accumulates across tests or runs; the full 53/53 suite runs clean in ~6.6 min single-worker with no volume-driven flake (the one historical flake was a stray-bounce **session count**, since hardened in Tests 39/40/43). **Free tier:** the `heatmap_test` schema is wiped every run; production `public` is not deployed yet (Vercel → M8) and is bounded by the 30-day TTL cleanup endpoint (Test 27); at POC volume (~1k/day) it stays well under the 0.5 GB Neon limit. **Re-validate at real Autohero scale when deployed (M8)** — mouse-move is the largest table and may then need grid-bucketing/pre-aggregation (already noted under Anticipated-M4 non-critical).

### Non-critical
- **CTA briefly missing after scroll on Personal Information (unconfirmed, runtime).** Manual observation (2026-05-23): on the Personal Information step, after triggering validation errors, scrolling up to complete the mandatory fields, then scrolling back down, the primary CTA button was momentarily absent and reappeared after about a second. **Could not confirm a cause in the code** — the CTA is rendered unconditionally inside `ActionBar` (`CheckoutFlow.jsx`), with no scroll check, timer, or validation gate that would hide it. Likely a runtime render/remount or sticky-positioning artifact rather than a logic bug. **Requires manual testing at later stages** to reproduce reliably and confirm before any fix. Surfaced during M4 Part 3 manual testing.
- **Thank-you page not covered by the heatmap.** Capture, drop-off, and the heatmap viewer cover the three checkout steps (`personal-info`, `delivery`, `pay`) but not the post-purchase thank-you page. Unlike Delivery/Pay — which were steps inside `CheckoutFlow` on the `/checkout/[sku]` route — the thank-you page is a separate route (`app/thankyou/page.jsx`) and a separate component (`ThankYouPage.jsx`), and `useCheckoutHeatmapCapture` is not wired there. Extending coverage means: add a `thank-you` step to `CHECKOUT_HEATMAP_STEPS` + labels, wire capture into the thankyou route, branch the heatmap viewer to render `ThankYouPage` instead of `CheckoutFlow` for that step (the main piece), add the dropdown item, and add tests + docs. Not in M2 scope (not planned) — surfaced 2026-05-21. **Update (2026-05-22): stays deferred, but M4 carries a readiness constraint** — M4's event/outcome model and step list must keep thank-you cheap to add (the `thank-you` step + a purchase-completed signal slot in without rework). Actual thank-you instrumentation remains a later follow-up.
- ~~**No interactive path to the Delivery/Pay steps.**~~ **Resolved in M4 Part 1 (2026-05-22).** Two root causes were fixed: (1) `getCheckoutHref` only emitted the `step` query param under `tour=1`, so a normal-mode CTA click navigated without `?step=` and never advanced — it now always carries `step`. (2) The observed double-click: `LeftCard`/`ActionBar` were defined inside `CheckoutFlow`, so they were new component types every render and React remounted the CTA button; the first click blurred the focused input → `setActiveField(null)` → re-render → button remounted mid-click → click swallowed. Both were hoisted to module scope. A single CTA click now advances each step when mandatory fields are valid (an invalid field blocks and shows the error). Covered by Test 28 (`tests/e2e/m4-step-nav.spec.ts`); full suite 34/34 green. (Tour mode's view-only overlay is unchanged, but tour mode is not the normal visitor path.)
- **Horizontal scrollbar on the mobile heatmap when fixed-overlay dots render (regression).** On the **mobile** heatmap viewer (observed on the `personal-info` step, `view=mobile_view`), rendering the dots — especially the **chatbot** fixed-overlay dot — makes a horizontal scrollbar appear. This is a recurrence of a previously-handled horizontal-scroll issue. Likely cause: the fixed dots are rendered at `<main>` level in `app/checkout/[sku]/heatmap/page.jsx` (the `fixedPoints.map(...)` block, `position: fixed` positioned by `right`/`bottom`), *outside* the `[data-checkout-heatmap-surface="shop-frame"]` element that the mobile override CSS clips with `overflow-x: clip`. A dot whose box reaches the viewport edge therefore adds to the page's scroll width with nothing clipping it. Candidate fixes: clip overflow on `<main>`/`body` on the heatmap route, or inset/clamp the fixed dot so its box never crosses the viewport edge. Surfaced 2026-05-21; documented as non-critical, not yet fixed.
- Heatmap data format has minimal migration handling for future schema changes.
- No export/debug tooling exists yet for inspecting stored raw heatmap sessions.
- Active session tracking logic is concentrated in one module and could use cleanup later.
- Test runtime is ~3.6 minutes for 24 tests — acceptable now, worth revisiting as the suite grows.
- Repo-local agents exist, but their discovery and usage path is still convention-based.
- **Tour mode is unrequested sandbox scaffolding.** A guided full-funnel walkthrough (landing → search → details → checkout → thank-you) exists in the Shop sandbox (`lib/prototype/tourSteps.js`, `components/prototype/TourRail.jsx`, `WelcomeScreen.jsx`, `tour=1` handling in `shopRuntime.js` / checkout page). It was never a specified requirement and is unrelated to capture or heatmaps; it is only relevant to M4 because its view-only overlay currently interferes with interactive step navigation (the Part 1 fix routes around it). Surfaced 2026-05-22. **Decision: kept for now, non-critical** — review later whether to remove it for a cleaner sandbox.
- **Text fields need two clicks to focus (all text inputs, all steps).** Clicking into any text field does not focus it on the first click — a second click is needed to place the cursor and start typing. Affects every `StickyInput` text field on every step: Personal Information (Name, Birthdate, Phone number, House number, ZIP) and Pay (card number / expiry / CVC / name, wire-transfer email). **Root cause is the same inline-component-in-render pattern fixed for the CTA in M4 Part 1:** `StickyInput` is defined **inside** `CheckoutFlow`, so it is a new component type on every render and React remounts every input each render. The first click focuses the input → `onFocus` sets `activeField` → re-render → the input remounts → the just-placed focus/caret is lost; the focus-restoration `useEffect` is meant to recover it but does not reliably restore the click on first interaction, so the visitor clicks again. **Fix:** hoist `StickyInput` to module scope (as `LeftCard`/`ActionBar` were in Part 1), passing `activeField`/`setActiveField` via props or a small context — this removes the per-render remount, and the focus-restoration hack then becomes unnecessary. **Acceptance:** every text field, on every step, becomes active and editable on the first click. Surfaced 2026-05-22 (manual Part 1 testing). **Non-critical** — does not affect capture or the heatmap; checkout-flow UX polish.

- ~~**Heatmap toggle UI is interim — to be simplified at the Dashboard milestone (M6).**~~ **Resolved in M6 P6 (2026-05-27).** The on-page Heatmap dropdown + Clear-data button were removed from the live Shop TopBar; the Desktop/Mobile + See-clicks/moves/scrolls toggle buttons were removed from the viewer; step label + stats moved to the TopBar `rightContent` slot. Controls now live in `/dashboard`.

- **Mouse-move trails can't attribute movement to floating elements.** *(Surfaced 2026-05-25, M4 Part 8 prep; deferred.)* Mouse-move events store only `x/y` + timestamp — no element link. The order-summary sidebar (desktop) and chatbot icon are `position: fixed`, so moves over them are stored in surface coordinates whose vertical value smears with scroll. Result: trails near these elements show **approximate right-side activity**, not movement glued to the element. **Accepted for the POC** (clicks already map fixed targets exactly via `fixedPoints`; a header note explains the limit to viewers — see M4 Part 8). **Proper fix (deferred):** at capture, tag each move with the fixed element it is over (hit-test), then map those moves to the pinned copy in the viewer — a capture-side change (~10 Hz hit-testing) + re-test + data regeneration, out of frozen M4 scope. **Non-critical** — does not affect clicks, scroll, or capture of any other signal.

- **Mouse-move/scroll trails assume the capture-time layout.** *(Surfaced 2026-05-25, manual visual check; partially fixed in Part 8.)* Moves/scrolls are stored as absolute surface `x/y` with **no element anchor**, so they only line up when the rendered layout matches what the visitor saw. The Part 8 fix renders the moves/scrolls views with validation off + accordions collapsed to match the **common** capture state, removing the systematic upward drift the fully-expanded viewer introduced. **Residual:** a visitor who moved *while* validation errors were showing (or a panel was open) still mismatches — one render cannot reconstruct every per-visitor layout. Inherent to absolute-coordinate movement. The layout-proof fix is to **anchor each move to an element at capture** (offset from nearest anchor, re-resolved at render — exactly how clicks already work): a capture-side data-model change + re-test + data regeneration, out of frozen M4 scope. Sibling of the floating-elements item above. **Non-critical** — clicks are unaffected (element-anchored).

- **Visibility observer thrashing + zero-click sessions never finalize.** *(Surfaced 2026-05-25, session-merge diagnosis; two deferred follow-ups to the activity fix.)* The `element-visible`/`element-hidden` IntersectionObserver fires in large bursts even with no user input (elements oscillating around the 50% threshold), inflating stored event volume. The 2026-05-25 fix stopped those events from counting as *activity* (so sessions idle out correctly), but did **not** quiet the observer itself — worth throttling/hysteresis later. **Non-critical** (observer thrashing). ~~Separately, a **zero-click** session never finalizes (the drop-off finalize requires ≥1 click — an M1 rule), so it stays `in-progress` and `clearResumeRef()` (only called on finalize) never runs, leaving the resume ref to linger. Harmless now that visibility no longer refreshes the resume clock, but allowing no-click bounces to finalize (M4 already records bounces) would be a cleaner second safety net.~~ **Resolved in M5 (2026-05-26):** the `≥1 click` gate (`hasClicks` in `saveSession`) was removed — any real activity (scroll, move, type, or click) now finalizes a drop-off session; `clearResumeRef()` runs correctly for zero-click bounces.

- **No logging / observability for app health (crash + connectivity).** *(New, surfaced 2026-05-24; deferred — future work.)* The product records *visitor behaviour* (clicks, movement, drop-off, exit reason) but has **no** application-health logging: it does not capture client-side JS errors/crashes or connectivity loss. Two limits make these only partly observable anyway — a full browser-tab crash leaves no client code to report it (only inferable on the next load), and an offline visitor usually cannot transmit anything until they reconnect (and nothing if the tab closes first). For visitor-behaviour purposes these simply fall back to the `idle` or `left-browser` exit reasons, so capture is unaffected. A dedicated effort (e.g. `window.onerror`/`unhandledrejection` capture, `online`/`offline` markers, a log sink) is deferred — explicitly **not** in frozen M4 scope. Relates to the **Event-delivery reliability** critical item above.

### Anticipated (M2) — outcomes at close
- ~~**M1 anchor-ID re-map — test updates.**~~ **Resolved in M2.** The 14 M1 IDs were re-mapped and the affected tests (anchor 7–9, registry-sync 11) updated. Stored M1 sessions were not migrated — cleared (Clear data) when the re-mapped IDs landed, so there is no session-migration debt.
- ~~**Scanner vs registry transition.**~~ **Resolved in M2.** `checkoutScanner.js` (live DOM discovery) is now the source of truth; the manual registry was replaced by the auto-maintained `CHECKOUT_ELEMENT_REGISTRY` snapshot. No coexistence remains.
- ~~**Auto-maintained registry snapshot sync.**~~ **Mitigated in M2.** The two-representation drift risk is enforced away by Test 11, which asserts registry↔DOM parity per step across all three steps. The snapshot cannot silently drift without failing the suite.
- **`data-heatmap-type` hints add manual tagging.** *(Standing operational note.)* Semantic types still depend on hand-placed `data-heatmap-type` attributes; a missing or wrong hint misclassifies an element. Mitigated by Test 14 (hint-wins) and the scanner's type-resolution precedence, but adding new semantic elements still requires correct manual tagging.
- ~~**Per-step fully-expanded heatmap render.**~~ **Addressed in Part 4.** Delivery has no conditional panels; Pay's card/wire detail panels are forced open in `heatmapMode` (`payment === "card" || heatmapMode`, same for wire) so all pay elements resolve. PI continues to use `heatmapMode`/`forceAllOpen`/`showBirthdateHelp`. Verified by Test 18 render half + Test 19.

### Anticipated (M3) — outcomes at close
Tech debt M3 was likely to introduce, identified upfront at milestone-start. Outcomes marked at M3 close (2026-05-22). (Critical anticipated items are tracked under **Critical** above — all three resolved.)
- **Schema defined but mostly unwritten.** *(Accepted by design.)* M3 defines the full `events[]` / `outcome` / `samplingRate` / step-timing / visibility schema, but only click capture writes to it until M4. Most columns are intentionally scaffolding — exercised end-to-end when the rich events arrive in M4. This is the deliberate "keep M3 simple" boundary, not unplanned debt.
- ~~**`clicks[]` → `events[]` generalisation touches many call sites.**~~ **Addressed in Part 2.** The rename was completed across capture, store, API, renderer, aggregation, and tests — not a store-only partial migration. The only remaining shim is intentional: `normalizeCheckoutHeatmapSession` still accepts legacy `clicks[]` on input and always outputs `events[]`, so old-shaped payloads degrade gracefully.
- **Unbatched write-per-event.** *(Accepted; deferred to M4.)* M3 ships the existing click capture pointed at Postgres with a per-event insert loop — knowingly non-scalable. The batched ingestion design is documented in `SCALE_DESIGN.md`; the pipe is built in M4 alongside the high-frequency events that make batching necessary.
- **Indexes / pooling validated only at POC volume.** *(Accepted; revalidate in M4.)* Write-optimised indexes and connection pooling are in place and designed for millions of rows but exercised only at ~1k/day. Query-API performance at scale and pre-aggregation stay unverified; pre-aggregation deferred until a query proves slow. Listed as an open risk in `SCALE_DESIGN.md`.
- **Query API has no auth or pagination.** *(Accepted; deferred.)* The read-only `GET` endpoints return JSON with no access control (→ M6) and no pagination/limits (→ harden in M8 / when a broad-timeframe query proves large). Acceptable at POC volume.
- **Local dev now requires network.** *(Accepted; inherent to Neon.)* The JSON store worked offline; the Neon dependency means dev/test need a reachable DB. Unavoidable given the Postgres decision; mitigated by the `heatmap_test` schema keeping test runs isolated.
- ~~**TTL / archival is new POC-grade infra.**~~ **Addressed in Part 4.** `cleanupCheckoutHeatmapSessions(before)` + `POST /api/checkout-heatmap/cleanup` (default 30-day retention, keyed on `finalized_at`) keep storage under the 0.5 GB Neon free limit. Covered by Test 27.

### Anticipated (M4) — identified at planning
Tech debt M4 is likely to introduce, identified upfront so implementation can plan for it. Outcomes to be marked at M4 close. (Critical anticipated items are tracked under **Critical** above.)
- **Mouse-move stored unaggregated.** Each sampled mouse position is its own `events` row. No grid-bucketing / pre-aggregation yet — the mouse-move table is the largest. Pre-aggregation deferred until a query proves slow (per `SCALE_DESIGN.md`).
- **Beacon payload size cap (~64 KB).** The unload `sendBeacon` commits the **whole** session's events (so field/visibility events and zero-interaction bounces survive an abrupt close), not just the pending buffer. On a *very long* session that full payload can exceed the ~64 KB cap and the beacon is rejected — dropping the tail not already delivered by an interval (5 s) / size (50) flush. Bounded (most events are already on the server, idempotently) but not zero. A fix would send only undelivered events on unload, or chunk the beacon. Deferred — acceptable at POC session lengths.
- ~~**Two renderings maintained until a winner is chosen.**~~ **Resolved in Part 8 (2026-05-25).** Part 6 shipped both mouse-move views (density + trails) and both scroll views (fold line + gradient) behind a toggle; Part 8 dropped the losers (density, fold line) and the entire `?style=` toggle, so each type now has one style. The temporary duplicate render code is gone.
- **`outcome=completed` is step-inferred.** Marked when the visitor reaches the final step (pay), not from a real purchase signal — the thank-you page is not instrumented (kept cheap to add). True completion fidelity awaits thank-you coverage.
- **Active/idle and visibility thresholds are heuristic.** Time-per-step active/idle split and the IntersectionObserver visibility thresholds are tunable values that will likely need adjustment against real data.
- **Density/trails client render performance.** Rendering many mouse-move points client-side may lag on long sessions; may need downsampling or canvas rendering later.
- **Step-navigation fix grows sandbox-specific code.** Making the CTA advance steps is shop-flow logic, not reusable heatmap-product code — adds to the sandbox-specific surface to separate at integration (M8).
- ~~**Mobile touch-move / swipe movement not captured (non-mandatory).**~~ **Resolved into scope — scheduled for Part 7 (2026-05-24).** Originally desktop-only through Parts 1–6; the next part captures **finger movement on mobile** via `touchmove` (throttled ~10 Hz, recorded as `mouse-move` events, includes scroll swipes), rendered in the "See mouse moves" view with a mobile-only disclaimer. See the "Movement" decision above and `ARCHITECTURE_OVERVIEW.md` → M4 Part 7.
- **Suite runtime growth.** More event types + new M4 tests push total runtime past the current ~6.5 min for 32 tests; revisit parallelism/sharding if it becomes painful.

### Anticipated (M5) — identified at planning
Tech debt M5 is likely to introduce, identified upfront so implementation can plan for it. Outcomes to be marked at M5 close. (Critical anticipated items are tracked under **Critical** above.)
- **`visitor_id` in localStorage is a POC stand-in.** Real product needs server-side identity (account-based, cross-device). A visitor returning on a different device gets a fresh identity — cross-device attribution is not possible in M5. Deferred to M8 integration.
- **New `visitor_id` minted at every login completion.** No reuse of a prior localStorage value, so a visitor who logs in twice in the same browser gets two different IDs. Cross-visit identity continuity is not possible in M5. Intentional POC simplification; needs rethinking for the real product.
- **`visitor_id` not exposed in query API.** Stored in the `sessions` DB table but not returned by `GET /api/checkout-heatmap/query`. Per-visitor outlier analysis requires direct DB access. API exposure deferred to a later milestone.
- **Login step not heatmap-captured.** The `login` step is a real flow step but interactions are not tracked by the heatmap in the POC. Built to be cheap to add at Autohero integration (same pattern as the thank-you page).
- **No credential validation.** Login name and password are cosmetic in the POC — no real auth or server-side validation. Real auth is an M8 integration concern.
- **Step nav exclusion of login is hardcoded.** The Personal Information | Choose Delivery | Pay & Finish nav explicitly omits `login`. As the step list evolves, this exclusion should be config-driven rather than hardcoded.
- ~~**`visitor_id` schema migration must reach both schemas.**~~ **Resolved in M5 Part 2 (2026-05-26).** `ALTER TABLE … ADD COLUMN IF NOT EXISTS visitor_id TEXT` applied to both `public` and `heatmap_test` schemas before tests ran. 58/58 suite green.
- **Suite runtime growth.** New login-step tests grow the suite further; revisit parallelism/sharding if runtime becomes painful.

### Anticipated (M6) — identified at planning
Tech debt M6 is likely to introduce, identified upfront so implementation can plan for it. Outcomes marked at M6 close (2026-05-27). No unresolved critical items.
- ~~**Dashboard config storage is ephemeral.**~~ **Resolved at M6 close:** config is stored in the Postgres `heatmap_config` table and persists across server restarts. Multi-instance concurrency (simultaneous admin writes racing) is tracked under "No concurrent-access safety" below and remains an M8 concern.
- **Secret-token auth is brittle.** The dashboard is protected by one env-based token shared with all admins. Revoking means all admins lose access and a new link must be generated and re-shared. No individual identity, audit log, or fine-grained permissions. Intentional POC simplification; real auth (account-based login, per-user audit trail, role-based access) is an M8 concern.
- **No concurrent-access safety.** If multiple admins access the dashboard simultaneously and both edit the same config setting, writes may collide or race (depending on storage backend). Acceptable for the POC if only one admin uses the dashboard at a time; proper locking/transactions needed for real concurrent use.
- **Dashboard UI is minimal.** The M6 UI is functional but not polished — no responsive design, loading states, error boundaries, or accessibility hardening. Acceptable for internal tool; user-facing polish deferred to M8 integration.
- **Test coverage is core-path focused.** The 8 new M6 tests cover the main flows (config save, heatmap viewer param passing, outcome filtering); edge cases, invalid inputs, and multi-step sequences are not exercised. Expand before production deployment.
- **Report generation is a placeholder.** The dashboard button is wired but does not generate a real report in M6 — it shows a "not yet implemented" message. The full AI report pipeline (data aggregation, LLM call, output formatting) ships in M7. M6's placeholder is a stub only.
- **Suite runtime growth.** New M6 tests (8 cases) grow the full suite; revisit parallelism/sharding if total runtime exceeds acceptable bounds.

### Anticipated (M6.1) — identified at planning
Tech debt M6.1 is likely to introduce, identified upfront at milestone-start (2026-05-28). Outcomes to be marked at M6.1 close. (Architecture in `ARCHITECTURE_OVERVIEW.md` → "M6.1 architecture".)
- **`source`→schema resolution must stay allowlisted (critical).** The viewer/API select the data schema from a `source` param. To avoid schema-injection, `source` is an **enum** (`real`/`sim`) mapped server-side by `resolveHeatmapSchema` to a concrete schema name — a raw schema name must never travel from the client into SQL. Must be in place (and the only schema-producing path) before M6.1 is complete.
- **Schema-migration burden grows.** Every future DB schema change (M7, M8) must now also target the sim schemas (`heatmap_sim`, `heatmap_test_sim`) in `scripts/db-setup.mjs`. Operational overhead; worth a checklist note in future milestone-start runs.
- **Synchronous generator may be slow.** Generating ~1500 sessions with events in a single request risks an HTTP timeout. Mitigated by bulk multi-row inserts (bounded round-trips); revisit with chunking or a background/streaming approach if measured runtime is poor.
- **Hardcoded simulation distribution.** Session count (~1500), outcome ratios (~65/35), exit reasons, and desktop/mobile split are hardcoded in the generator. Acceptable POC simplification; revisit if realistic variation is needed.
- **Sim data persists until manually discarded.** No auto-cleanup; stale sim data could confuse a future admin if Discard is forgotten. The confirmation pop-up is the only safeguard. (Test runs are wiped by `global-teardown`.)
- **Simulation fixed to Personal Information only.** Extending to other steps requires generator changes. Acceptable for the POC.

### Anticipated (M6.2) — identified at planning
Tech debt M6.2 introduced by scoping unit tests only to already-pure modules; non-unit-testable logic was deferred. No critical items. Outcomes to be marked at M7.1/M7.2 close.
- **Capture-window date check not unit-tested (deferred to M7.1).** The local-day boundary check lives inside `checkoutHeatmapClient.js`, a browser module that cannot be imported in Node/Vitest without globals. Extract to a pure helper module in M7.1, then add unit tests covering `from`/`to` boundary logic.
- **Ingest config gates not unit-tested (deferred to M7.2).** The four gates (step gate, sampling gate, capture-window gate, event-type filter) are embedded inside `app/api/checkout-heatmap/ingest/route.js`, mixed with `NextResponse` and DB calls. Extract to a pure helper module in M7.2, then add unit tests for each gate.

## Potential post-MVP items

Ideas surfaced during development that are out of current scope but worth preserving for after the POC/MVP proves out. Not committed; each needs its own milestone scoping.

### 1. Session replay — visitor journey reconstruction (Mouseflow-style)

Replay a visitor's session as a watchable journey — clicks, mouse movement, scrolling, and field interactions over time — to qualitatively review individual drop-offs alongside the aggregate heatmaps.

**Feasibility:** Partially supported by the existing data model. Events are stored timestamped and ordered (M3 `events[]`), so a visitor's path can be reconstructed and animated on the standalone viewer replica.

**Constraints:**
- True pixel-perfect replay (like Mouseflow) requires DOM snapshots + mutation capture, which we do **not** record today — only element-anchored events.
- Replay accuracy is bounded by the viewer replica staying in sync with the host UI (same limitation as the current standalone viewer).
- Mouse-move fidelity depends on the M4 throttle/sampling rate — sparser sampling means a coarser path.
- Best treated as a separate milestone (capture additions + a replay player + storage cost review).

### 2. Combined heatmap overlay — stack two layers on one map

Today each event type renders as its own toggled view (click dots, mouse-move density/trails, scroll fold/gradient). This idea lets the viewer overlay two layers at once on a single map — e.g. click dots on top of the scroll gradient — to correlate signals without switching views.

**Feasibility:** The data and per-layer renderers already exist after M4 Part 6; combining is a viewer-only change (render two overlays together, no new capture).

**Constraints:**
- Readability is the main risk — stacking dots + cloud + lines + color tint quickly gets cluttered and hides signals. Industry tools (Hotjar, Clarity) keep layers separate for this reason.
- Should be limited to two compatible layers, not all five at once, with clear visual separation (e.g. opacity, distinct encodings).
- Click-precision tests assume clicks render alone by default — a combined mode must be opt-in and not change the default view.

### 3. Click density cloud — blurred hotspot view (evaluated M4 Part 8, deferred)

A second click visualisation: instead of one dot per element, merge nearby clicks into a smooth blurred red "cloud" so the busiest regions glow as hot zones. Prototyped as "Option 4" during the Part 8 click-prominence exploration (2026-05-25) and well-liked for showing overall heat.

**Feasibility:** Renderer-only; the aggregated click points already exist. A blurred radial-gradient overlay layer plus its own toggle.

**Constraints:**
- Loses per-element precision (blurs across the 10px mapping rule), so it cannot be the **default** click view and would need its own toggle + tests.
- Part 8's MVP choice is **opacity-by-count on precise dots** instead (keeps precision, near-zero cost). The cloud is a richer follow-up, not built now.





## Milestone 1
- Goal: get the heatmap working for the Personal Information checkout step.
- The heatmap must exist and show visitor clicks on the checkout screen as dots.
- Dots must be mapped to the actual checkout screen with no more than 10px deviation.
- Dot radius must increase based on how many clicks occurred on the exact same pixel.
- Example rule: if one pixel has 50 clicks and another has 20 clicks, the first dot should be 2.5 times larger, within sensible visual bounds.
- M1 is limited to the Personal Information step only. Support for other screens will be added later.
- The heatmap surface is the full checkout page, including the Personal Information form, order summary/sidebar, header, and any other clickable area on that screen.
- Heatmaps must be separated by actual rendered layout: `desktop_view` and `mobile_view`.
- To preserve mapping precision, events should store the exact viewport dimensions and be classified by the real rendered layout breakpoint.
- M1 should capture click-equivalent interactions: desktop mouse clicks, touchpad clicks, and mobile taps.
- Every raw click should be stored. No deduplication should happen at capture time.
- For M1, aggregation is based on exact pixel coordinates only. Adjacent pixels must remain separate hotspots.
- M1 should use radius only to represent click intensity. Color intensity can be added later.
- Initial radius bounds for M1 are `6px` minimum and `24px` maximum. These can be adjusted later.
- Initially, only drop-off sessions should be recorded and visualized.
- For M1, a drop-off means the visitor opens the Personal Information step, performs at least one interaction, and then has no actions at all for 30 seconds.
- For M1, inactivity should mean no tracked interaction of any kind, including click/tap, scroll, key input, focus, or field change.
- Every opening of the Personal Information step should be treated as a new session.
- M1 should include every session for now, including internal or test usage.
- The heatmap should use all recorded history.
- A `Clear data` button should be added to the header so data can be reset frequently during M1.
- The Shop header should contain two buttons for M1: `Heatmap` to open the heatmap in a new browser tab and `Clear data` to remove recorded data.
- The heatmap must open in a dedicated browser tab, not as an inline overlay on the live checkout page.
- The heatmap view must look exactly like the Personal Information checkout step so click positions align with the real screen.

### M1 Implementation Flow
- Instrumentation and session/drop-off capture.
- Storage and clear-data flow.
- Header actions.
- Dedicated heatmap route/view rendering the Personal Information step in a separate browser tab.
- Radius scaling and view separation.
- Verification and regression coverage.

### M1 Agents
See `Documentation/AGENTS.md` for the full agent catalogue. Seven agents were active at M1 close: `test-impact`, `regression-triage`, `heatmap-qa`, `anchor-registry`, `milestone-test-planning`, `milestone-doc-review`, `milestone-prereqs`.

## Future Milestones

### M2 — Full Checkout Coverage

#### Goal
Replicate the M1 heatmap behavior across all checkout steps, replace the manual element registry with an auto-discovery scanner, and make the system extensible to any step — current or future — without code changes per step.

#### Scope

**Auto-discovery scanner**
- A config-driven scanner replaces the manual `PERSONAL_INFO_ELEMENT_REGISTRY`
- The scanner runs against the rendered DOM and identifies trackable elements by type (e.g. `input`, `select`, `button`, `[role="checkbox"]`, `[role="radio"]`)
- The trackable element type list is defined in this document (see below) and implemented as a JS config file in code with two explicit sections: auto-discovered element types and manual-only elements
- Any element carrying a `data-heatmap-id` attribute is also tracked regardless of type — this is the escape hatch for custom elements the scanner does not recognise
- Both auto-discovered and manually tagged elements are treated identically by capture and rendering
- Individual element types can later be enabled or disabled via the admin dashboard (M6) without code changes
- **The M2 config file carries no enable/disable state.** In M2 every listed element type is active. The config describes only *what is trackable* (auto-discovered types + the `data-heatmap-id` escape hatch). Per-type enable/disable is deferred entirely to M6 and will be stored as runtime/dashboard config (not in the code config file), consistent with the M6 "without code changes" requirement.

**Anchor ID format**
- Anchor IDs are label-based: derived from the element's visible label or accessible name (e.g. `button:continue`, `textbox:name`)
- Where two elements share the same label, a position tiebreaker is appended to ensure uniqueness (e.g. `button:continue`, `button:continue-2`)

**Step coverage**
- Capture, drop-off detection, view separation, and heatmap rendering apply to all three steps: `personal-info`, `delivery`, `pay`
- The system is extensible to new steps without hardcoding step names — pointing the scanner at any rendered step is sufficient
- The active checkout step is passed explicitly to the client on initialisation — it is not auto-detected from the DOM

**Session model**
- One session per step visit (same as M1) — each step generates its own independent sessions
- Sessions carry a `step` field identifying which step they belong to
- Existing M1 sessions are retroactively tagged as `personal-info`

**Drop-off definition**
- Same rule as M1: at least one interaction + 30 seconds of inactivity
- Applies to all steps equally for M2

**Heatmap viewer**
- Single heatmap route, step-aware via `?step=` query param (e.g. `?step=delivery&view=mobile_view`)
- The **Heatmap** button in the top bar becomes a dropdown listing all available steps — selecting a step opens its heatmap in a new tab
- The desktop/mobile toggle remains inside the heatmap page

#### Out of scope for M2
Mouse moves, scroll, hover tracking; admin dashboard; AI reporting; login step; real database; JS snippet / external integration; dashboard-driven element toggling.

#### Trackable element types (scanner config)
- `input` — all text, number, email, date, and similar input fields
- `select` — native select dropdowns
- `button` — all buttons including submit and navigation
- `[role="checkbox"]` — checkbox controls
- `[role="radio"]` — radio button controls
- `[role="combobox"]` — custom dropdown/combobox components
- `[role="listbox"]`, `[role="option"]` — selectable list items
- `a` — links that trigger navigation or selection within the flow

**Non-interactive trackable types** (display-only; click-trackable, no focus/input):
- `display` — read-only value fields (e.g. City, Country rendered as static text). Replaces the misregistered `textbox:city` / `textbox:country` entries.
- `error` — validation / error messages (detected via `data-field-error`); tracked because where errors surface is itself a drop-off signal.

#### Scanner config file structure (confirmed)
The config file has two sections only — auto-discovered element types and the manual-only escape hatch. It holds no enable/disable state (see Auto-discovery scanner notes above).

```js
export const scannerConfig = {
  autoDiscovered: ['input', 'select', 'button', '[role="checkbox"]', '[role="radio"]', '[role="combobox"]', '[role="listbox"]', '[role="option"]', 'a'],
  manualOnly: '[data-heatmap-id]',
};
```

#### Element register — full type taxonomy (M2)

Every scanned element is emitted in the existing registry shape (`{ id: "type:label-slug", type, label, selector }`). Discovery legend: **auto** = found structurally by the scanner; **hint** = requires an explicit `data-heatmap-type` attribute (semantic, not inferable from markup); **manual** = comes via the `data-heatmap-id` escape hatch.

| `type` | Meaning | Detected by | Discovery |
|---|---|---|---|
| `text` | Single-line free text | `input[type=text]`, `textarea` | auto |
| `email` | Email field | `input[type=email]` | auto |
| `number` | Numeric field | `input[type=number]` | auto |
| `date` | Date picker | `input[type=date]` / custom date component | auto/hint |
| `tel` | Phone / telephone field | `input[type=tel]` | auto/hint |
| `password` | Masked field (M5) | `input[type=password]` | auto |
| `dropdown` | Single-choice select | `select:not([multiple])`, `[role=combobox]` | auto |
| `multiselect` | Multiple-choice select | `select[multiple]`, `[role=listbox][aria-multiselectable=true]` | auto |
| `button` | Standard generic button | `button`, `[role=button]` (no more specific match) | auto |
| `cta` | Primary call-to-action button | semantic | hint |
| `toggle` | Two-state / on-off switch (incl. segmented) | `button[aria-pressed]`, `[role=switch]`; segmented via hint | auto/hint |
| `tooltip` | Tooltip trigger (opens popover) | `[aria-haspopup]` / hint | hint |
| `tooltip-content` | Tooltip content (the popover) | `[role=tooltip]` | auto |
| `radio` | Single-choice option in a group | `[role=radio]`, `input[type=radio]` | auto/hint |
| `checkbox` | On/off checkbox control | `[role=checkbox]`, `input[type=checkbox]` | auto/hint |
| `link` | URL navigation anchor | `a[href]` | auto |
| `nav` | Navigation region / step indicator | `data-heatmap-id` | manual |
| `area` | Non-interactive content zone | `data-heatmap-id` | manual |
| `accordion` | Expand/collapse panel header | `data-heatmap-id` | manual |
| `icon` | Standalone icon control | `data-heatmap-id` | manual |
| `display` | Read-only value field (e.g. City, Country) | `data-heatmap-id` | manual |
| `error` | Validation / error message | `data-field-error` | auto |

**Detection model (confirmed):** semantic types (`cta`, `toggle`, `tooltip`, and date/tel/radio/checkbox controls implemented as plain `<button>`/`<input>`) cannot be inferred from markup. They are declared via an explicit `data-heatmap-type` attribute; the scanner trusts the hint over the structural guess.

**M1 re-map (confirmed):** existing M1 anchor IDs are re-mapped to the accurate vocabulary — an element that is a dropdown must be typed `dropdown`, etc. — rather than carried forward unchanged. The 14 affected entries:

| M1 name | M2 name | Reason |
|---|---|---|
| `textbox:name` | `text:name` | plain text input |
| `textbox:birthdate` | `date:birthdate` | date field (text-as-date, via hint) |
| `textbox:phone-number` | `tel:phone-number` | phone field (via hint) |
| `textbox:street` | `dropdown:street` | it is a `<select>`, not an input |
| `textbox:house-number` | `text:house-number` | text input (alphanumeric) |
| `textbox:zip` | `text:zip` | text input |
| `textbox:city` | `display:city` | read-only `<div>` |
| `textbox:country` | `display:country` | read-only `<div>` |
| `button:birthdate-help` | `tooltip:birthdate-help` | tooltip trigger |
| `tooltip:birthdate-help` | `tooltip-content:birthdate-help` | the popover content |
| `button:cta` | `cta:choose-delivery` | primary CTA (label-based) |
| `radio:private` | `toggle:private` | account-type toggle |
| `radio:company` | `toggle:company` | account-type toggle |
| `area:order-summary` | `toggle:order-summary` | mobile expand/collapse button |

Unchanged (already correct): `nav:*`, `dropdown:phone-code`, `radio:color-*`, `checkbox:waterproof-cover`, `accordion:*`, `area:reviews`, `icon:chatbot`. The two `birthdate-help` rows must be applied together to avoid an ID collision.

**Order summary — split by view:** mobile and desktop are different elements and get separate anchors:
- `toggle:order-summary` — the mobile expand/collapse `<button>` (already tagged; the rename above).
- `area:order-summary` — the always-visible desktop sidebar. **Needs a new `data-heatmap-id`** added to the *visible (fixed)* `SummaryCard`, not the `aria-hidden` layout spacer. The sidebar is `position: fixed`, so clicks must anchor to the fixed card and store offsets relative to it, and the heatmap view must render it fixed — so dots land on the sidebar regardless of scroll. See `ARCHITECTURE_OVERVIEW.md`.

#### Implementation plan (phased)

M2 is delivered in five sequential parts. Each part ends with a verifiable deliverable; the next part does not begin until the current one is checked. Existing stored M1 sessions are **not migrated** — they are cleared (Clear data) when the re-mapped IDs land.

**Part 1 — Scanner replaces the registry (Personal Information only)**
- New: `lib/prototype/scannerConfig.js` (the `autoDiscovered` + `manualOnly` config), `lib/prototype/checkoutScanner.js` (scans the rendered DOM, applies `data-heatmap-type` hints, emits anchors and maintains the registry snapshot).
- Changed: `checkoutHeatmapRegistry.js` becomes an auto-maintained snapshot (not hand-edited); `CheckoutFlow.jsx` gets `data-heatmap-type` hints + the 14 re-mapped IDs + new desktop `area:order-summary` tag; `checkoutHeatmapClient.js` anchors via the scanner.
- Deliverable: PI heatmap behaves as in M1 but is scanner-driven; `display` (City/Country) and `error` anchors are captured.

**Part 2 — Step-aware sessions**
- Changed: active step passed explicitly to the client on init; sessions carry a `step` field; drop-off logic runs per step. Touches `checkoutHeatmapClient.js`, `checkoutHeatmapStore.server.js`, `app/api/checkout-heatmap/route.js`.
- Deliverable: PI sessions tagged `step: "personal-info"` (Test 1).

**Part 3 — Extend to Delivery + Pay**
- Changed: `CheckoutFlow.jsx` delivery/pay elements get IDs/hints; scanner runs per step; fixed desktop sidebar anchoring implemented.
- Deliverable: all three steps capture step-tagged sessions with correct dots.
- **Status: capture done.** Capture enabled on all steps; delivery/pay options and CTAs tagged (`radio:delivery-*`, `radio:pay-*`, `cta:pay-finish`, `cta:pay`); step-tagged capture verified (Tests 12 delivery/pay, 18 capture half) in `tests/e2e/m2-delivery-pay.spec.ts`. The desktop fixed-sidebar anchor was already wired in Part 1. Render-side verification of delivery/pay dots is delivered with the step-aware viewer in Part 4.

**Part 4 — Step-aware heatmap viewer**
- Changed: `app/checkout/[sku]/heatmap/page.jsx` becomes step-aware via `?step=`; `TopBar.jsx` Heatmap button becomes a step dropdown; desktop/mobile toggle retained.
- Deliverable: selecting a step opens its heatmap in a new tab.
- **Status: done.** Viewer resolves `?step=` via `resolveCheckoutHeatmapStep`, filters sessions to step + view, renders the step's `CheckoutFlow` fully-expanded with a per-step title, and keeps the desktop/mobile toggle (step preserved in the toggle links). `TopBar` Heatmap button is now a step dropdown opening `?step=<step>` in a new tab. Pay step card/wire panels are forced open in `heatmapMode`. Verified by Test 3 (dropdown), Test 18 render half (delivery/pay dots), and Test 19 (step-aware viewer) — 23 tests green.

**Part 5 — Hardening + close**

*Tests / precision:*
- ~~**Test 17 — fixed-position precision.**~~ **Done.** `tests/e2e/m2-fixed-position.spec.ts` clicks the desktop order-summary sidebar + chatbot icon and asserts the fixed-overlay dots land on each element (≤10px) both at the top of the heatmap and after scrolling. Measured: sidebar 0.0px, chatbot 1.4px. No anchoring hardening was needed — the existing fixed-overlay capture/render path was already precise.
- ~~**Test 11 — registry-sync re-point.**~~ **Done.** The parity check now reads the step-aware `CHECKOUT_ELEMENT_REGISTRY` snapshot and asserts both directions per step across `personal-info`, `delivery`, and `pay`.
- ~~Full M2 regression green on `localhost:3000`.~~ **Done — 24/24 green.**
- *Optional hardening (carried over from Part 4, non-blocking):* dropdown dismiss (Escape / outside-click), an explicit assertion that the Pay step renders both card + wire panels open, and selecting Personal Information from the dropdown end-to-end. *(Not implemented — non-blocking, carried forward.)*

*Milestone close (gates per AGENTS.md / Working rules):*
- ~~**Agent review.**~~ **Done.** `anchor-registry` deprecated (superseded by the scanner); `test-impact` and `heatmap-qa` updated to the M2 suite/scanner; AGENTS.md catalogue updated.
- **`milestone-doc-review`.** Run against code + tests; fix anything stale, missing, or inconsistent (including `ONBOARDING.md`).
- ~~**Tech-debt review.**~~ **Done.** Resolved/mitigated items struck through above; no open critical items. The "no interactive path to Delivery/Pay" item was **accepted and deferred** (2026-05-21) with rationale.
- **`FUTURE_THIRD_PARTY_INTEGRATION.md` review/update.**
- **`milestone-prereqs`** → returns READY (logged in `AGENT_RUN_LOG.csv`).

- Deliverable: M2 suite green; all milestone-close prerequisites met (`milestone-prereqs` READY).

**Status: CLOSED (2026-05-21).** All five parts implemented, 24/24 automated tests green, all close gates logged OK, and the user confirmed manual validation of Part 5 fixed-position scope (sidebar + chatbot dots land and stay glued on scroll). M2 is complete.

#### Test cases (M2)

Full specifications live in `TEST_CASES.md` (M2 section); numbering continues from M1.
- **7 M1 tests updated** (Tests 1, 3, 7, 8, 9, 10, 11): add session-`step` assertions, the Heatmap **step dropdown**, scanner-resolved **re-mapped anchor IDs** with new `date`/`display` targets, `error`-capture assertions, and registry-sync against the **auto-maintained snapshot** across all steps. Tests 2, 4, 5, 6 unchanged.
- **8 new cases** (Tests 12–19): step-field tagging, scanner auto-discovery of untagged elements, `data-heatmap-type` hint honored, `display` capture, `error` capture, fixed-position precision (sidebar + chatbot), delivery/pay coverage, and the step-aware viewer.
- **Status (Parts 1–5 done):** 24 tests green on `localhost:3000`. Part 2 added the `step` assertion to Test 1 and Test 12 (personal-info scenario). Part 3 added Test 12's delivery/pay scenarios and the capture half of Test 18 in `tests/e2e/m2-delivery-pay.spec.ts`, with capture enabled on all three steps. Part 4 added the Test 3 step-dropdown assertion, the render half of Test 18 (delivery/pay dots) in `m2-delivery-pay.spec.ts`, and Test 19 (step-aware viewer) in the new `tests/e2e/m2-viewer.spec.ts`. Part 5 added Test 17 (fixed-position precision) in the new `tests/e2e/m2-fixed-position.spec.ts` and re-pointed Test 11 at the step-aware `CHECKOUT_ELEMENT_REGISTRY` snapshot, asserted across all three steps.

### M3 — Data Completeness and Query Capability
Audit and extend the captured data model to contain everything needed for heatmaps and AI reporting. Add a query interface (API or admin tool) so an admin can retrieve raw session and event data filtered by step, view, timeframe, and other dimensions. This is the foundational layer for report generation.

**Scale note:** The target deployment (Autohero) has thousands of visitors per day. M3 must be designed for this volume from the start — not retrofitted later. This means: event ingestion via batching rather than one HTTP request per event; DB schema and indexing optimised for write throughput; aggregation queries (heatmap, report) designed to run efficiently over millions of rows; connection pooling; and a sampling strategy for high-frequency events like mouse movement. Any data model or storage decision made in M3 should be validated against this volume expectation.

> **STATUS: CLOSED (2026-05-22).** All five parts delivered. 32/32 automated tests green on the Neon Postgres store via the isolated runner. Scale/ingestion/sampling design documented in `SCALE_DESIGN.md` (design-only; pipe built in M4). All close gates met: tech-debt review done (three critical M3 items resolved — test-DB isolation, DB-credential handling, stale agent definitions), agents reviewed (5 made discovery-based + reference-resolution check added; none added/removed/deprecated), `FUTURE_THIRD_PARTY_INTEGRATION.md` and `DATA.md` reviewed, `milestone-doc-review` logged GAPS-FIXED, `milestone-prereqs` READY. Scope was frozen 2026-05-21.

#### Decisions agreed (2026-05-21)

**Storage & deployment**
- Storage: Vercel Postgres (Neon). Free tier covers the POC (~30k visitors/month ≈ 1k/day). Storage cleanup (TTL/archival) is in scope to stay under the 0.5 GB free limit.
- Dev: app runs locally against Neon via the pooled connection string. Vercel deploy deferred to M8.

**Query interface**
- Read-only query API only (GET endpoints returning JSON), filterable by step, view, timeframe, and other dimensions.
- No browsing UI in M3 (deferred to M6 dashboard). No access control in M3 (deferred to M6).
- Manual testing = call endpoint URLs and inspect the JSON.

**Heatmap event model (POC scope = P0–P2 + mouse movement)**

This is the full data model the M3 **schema must support**. Actual *capture* of these events (beyond the existing click capture) is **M4** — M3 only ensures the schema can hold them.

- P0: click/tap (existing), scroll depth.
- P1 (field-level friction): field focus, blur, change, time-in-field, validation errors shown.
- Session/step coverage: record zero-interaction sessions (immediate bounce); capture exit reason (`idle` / `nav-click` / `back` / `left-browser`); time-per-step with active vs idle split.
- **Record all sessions, not just drop-offs:** every visit to a step is recorded and tagged with an explicit `outcome` (completed/advanced vs abandoned). This is required for the completers-vs-non-completers report comparison — without completers there is nothing to compare against.
- Attention/exposure: element-visible / element-hidden (via IntersectionObserver) → per-element visible duration.
- P2 (derived): form abandonment, rage clicks, dead clicks, step navigation.
- Mouse movement: included, with throttling/event-sampling + batching; gated by an enable/disable config flag.
- Deferred for POC: hover/dwell, resize/orientation, text selection.

**Schema principles**
- Generalise `clicks[]` → `events[]` with a `type`; store raw + extensible (e.g. JSON detail column) so M4 events and changing report needs slot in without migration.
- POC data is throwaway — schema can change freely; clear and regenerate rather than migrate.

**Sampling & monetization** *(M3 defines the `samplingRate` field only; the sampling mechanism/gate is built in M4 with the capture pipe.)*
- Internal visitor-level sampling: config rate + per-visit decision persisted in a cookie, gating the capture client. **(Mechanism = M4.)**
- Event-level sampling for high-frequency events (mouse movement). **(Mechanism = M4.)**
- Store an effective `samplingRate` per session (external % × internal %): drop-off ratios need no adjustment; absolute counts get scaled up using this rate. **(Field = M3.)**
- External (host) traffic limiting: the tool works normally on whatever traffic it receives; we only need to record the external rate. The signalling/limiting mechanism is an M8 integration contract.
- The internal lever is the enforcement point for future usage-based pricing (monetization) — product-vision note; packaging logic itself is far-future (post-POC).

**Report sections (M7 sketch — drafted in M3 to drive data needs)**

This sketch guides what M3 must capture; the sections themselves are an M7 deliverable and may change. Because storage is raw + extensible, changing/reordering sections later is cheap — only never-captured signals are unrecoverable.

- **Intro / methodology** — steps covered, events collected, timeframe, sample size, sampling rate. *(Report metadata; no new capture.)*
- **Executive summary** — overall drop-off rate, biggest friction point, top recommendation. *(Funnel totals.)*
- **Funnel overview** — visitors per step, drop-off % between steps. *(Step entries/exits, sampling rate.)*
- **Step-level drop-off** — per step: entries, exits, bounces, time-on-step. *(Zero-interaction sessions, step timing.)*
- **Completers vs non-completers** — compare the actions of visitors who completed a step against those who abandoned it. *(Requires recording all sessions + the `outcome` field.)*
- **Last X actions before drop-off** — the final X events before abandonment; X is a configurable report-time value. *(Ordered, timestamped event stream — already captured.)*
- **Field-level friction** — per field: abandonment, time, errors. *(focus/blur/change, time-in-field.)*
- **Error analysis** — which validation errors appear before people quit. *(validation-error events.)*
- **Attention / engagement** — which areas were seen vs skipped. *(element visibility, scroll depth.)*
- **Frustration signals** — rage clicks, dead clicks, by location. *(click-stream derivations.)*
- **Device / view breakdown** — desktop vs mobile differences. *(view, viewport.)*
- **Recommendations & hypotheses** — actionable changes + testable ideas. *(Derived from all above.)*

**Scale mechanics (from the scale note)**
- Write-optimised schema + indexes (step / view / timestamp) and connection pooling are **designed and set up in M3**.
- Batched event ingestion + the sampling gate are **built in M4** with the capture pipe. M3 documents the design; it does not build the batched pipe.

**Milestone boundaries** *(decision 2026-05-21: keep M3 simple)*
- **M3:** move to Postgres (replace the JSON store); define the full schema (events, `outcome`, `samplingRate`, step timing, visibility, etc.); point the *existing* click capture at Postgres (basic write, not batched); read-only query API; design + document the scale/ingestion/sampling approach.
- **M4:** build the batched ingestion pipe + the sampling/config gate; capture the rich new events (mouse-move, scroll, field events, visibility); render them.
- **M6:** config UI (enable/disable per event type, traffic %, steps, element types, timeframe).
- **M8:** external integration contract (how Autohero limits/signals traffic) + analyst DB access + Vercel deploy.

#### Open items (still to decide before freeze)
- ~~**M3/M4 boundary.**~~ **Decided (2026-05-21): keep the split, and keep M3 simple.** M3 = Postgres + full schema + existing click capture moved to Postgres + query API + scale design. M4 = batched ingestion pipe + sampling/config gate + capture & render the rich events. The schema makes room so M4 plugs in without rework. (See Milestone boundaries above.)
- ~~**Report sections sketch.**~~ **Done (2026-05-21).** 12 report sections drafted (see Report sections above), each mapped to its data need. Drove one capture change: record all sessions + an `outcome` field.
- ~~**Pre-aggregation.**~~ **Decided (2026-05-21): query raw rows on demand, pre-aggregation-ready.** POC volume (~1k/day) is fine with indexed raw queries; scale goal met by indexing + query design, not rollups yet. Add rollup tables/materialised views only when a query proves slow or at real Autohero scale. Mouse-move may need light aggregation sooner.
- ~~**Build-now vs design-only.**~~ **Decided (2026-05-21): keep M3 simple — design-only.** M3 documents the batching/sampling approach but does not build the pipe or gate; both are built in M4 alongside the events they serve. M3's only write path is the existing click capture pointed at Postgres.

#### Test cases (M3)
Full specifications live in `TEST_CASES.md` (M3 section); numbering continues from M2. Plan produced by `milestone-test-planning` (logged `OK` 2026-05-22).
- **Keep as-is (11):** Tests 3, 4, 5, 6, 7, 8, 9, 10, 11, 17, 19 — assert on rendered dots / UI / structure, unaffected by the store swap or the `clicks[]`→`events[]` rename; act as regression coverage that Postgres did not change behavior.
- **Update (8):** Tests 1, 2, 12, 13, 14, 15, 16, 18 — assertions reading `session.clicks` move to `session.events` (a click is `type:"click"`); Test 2 also reconfirms `DELETE` empties the Postgres store. **Done in Part 2 (2026-05-22); 24/24 green on Postgres.**
- **Remove (0).**
- **New (8):** Tests 20–27 — click stored as an event, `outcome` field, `samplingRate` field, query API filters (step / view / timeframe / combined), and TTL/archival. Tests 20–26 implemented in Part 3 (2026-05-22); Test 27 implemented in Part 4 (2026-05-22). **32/32 green** (24 carried + 8 new).
- **Prerequisite (not a test case):** test-DB isolation + clean teardown. **Resolved in Part 1** via `heatmap_test` schema in Neon, controlled by `HEATMAP_DB_SCHEMA` env var.

### M4 — Extended Interaction Capture
Expand captured interactions beyond clicks to the rich event set defined in the M3 event model, and build the batched ingestion pipe + sampling gate designed in `Documentation/SCALE_DESIGN.md`. Update the heatmap rendering to visualise the highest-value new event types.

> **STATUS: CLOSED (2026-05-26). SCOPE FROZEN (2026-05-22). Parts 1–8 done + Part 8 port (Chunks A–F) done (Part 1 2026-05-22, Parts 2–4 2026-05-23, Parts 5–6 2026-05-24, Part 7 2026-05-24, Part 8 port 2026-05-25); suite 52/52 active tests passing (Tests 36 + 44 are `test.fixme`, deferred to M5). Part 7/8 were split 2026-05-24 so the close is not blocked by the new feature. Both critical tech-debt items (event-delivery reliability, event-volume vs free tier) are resolved. Close gates met (2026-05-26): `milestone-doc-review`, agent review, `milestone-prereqs` → READY.** All scope decisions agreed (below). Architecture + 7-part implementation plan documented in `ARCHITECTURE_OVERVIEW.md` → M4; anticipated tech debt recorded (2 critical, Anticipated-M4 non-critical list); test plan produced (`TEST_CASES.md` → M4, `milestone-test-planning` logged OK 2026-05-22). No new features to be added mid-milestone. `milestone-start` returned READY (logged 2026-05-22). **Part 1** — interactive step navigation (Test 28). **Part 2** — batched ingestion pipe (`/ingest`, multi-row INSERT) + visitor sampling gate (cookie, 100% default), capture routed through the pipe, legacy POST kept but no longer client-called (Tests 29–30). **Part 3** — desktop mouse-move (~100ms throttle) + scroll-depth capture through the batched pipe; events are polymorphic (clicks keep the rich anchor shape, movement/scroll carry minimal payload) and the click heatmap is unchanged since aggregation still filters click/tap (Tests 31–32). **Part 4** — field focus/blur/change (change recorded on blur, never the raw value — only filled/length), validation-error-shown (MutationObserver over `data-field-error`), and element visibility (IntersectionObserver, ≥50% = seen) over all scanned anchors, with per-element visible duration on element-hidden (Tests 33–35). **Part 5** — session resume within X (localStorage-persisted id; 30s normal / 2s autotest), lazy/derived finalize via a `POST /api/checkout-heatmap/sweep` endpoint (no always-on runtime), zero-interaction bounce committed on the exit beacon, `exit_reason` (`idle`/`nav-click`/`back`/`left-browser`), active/idle step timing (`step_active_ms`+`step_idle_ms` = duration), `advanced`/`completed` outcomes flushed on step navigation, and a one-time post-suite `heatmap_test` wipe (Tests 36–38 + 41; Test 1 Scenario A now a recorded bounce). Field/visibility events now ride the exit beacon, resolving the Part 4 transitional limitation. **Part 6** — rendering: the heatmap page gained a nested **type → style** toggle (URL-param driven, alongside `?step=`/`?view=`) — **See clicks** (default, unchanged click dots), **See mouse moves** (density / trails), **See scrolls** (fold line / gradient); only one type renders at a time and a URL with no `type` keeps the click view. Each view filters `session.events` by `type`; overlays render inside the shared shop-content surface via a new `ShopFrame` `overlay` slot. Also added the stored `in-progress` outcome — committed-but-unfinalized sessions read `in-progress` (server-stamped in `ingestCheckoutHeatmapBatch`), the sweep matches `outcome IS NULL OR 'in-progress'`, and a terminal outcome is never overwritten by a late `in-progress` flush (upsert CASE guard) (Tests 39–40 + 42).

#### Decisions agreed during planning (2026-05-22)
- **Event scope = the frozen M3 event model.** Capture mouse movement (throttled), scroll depth, field focus/blur/change, validation-error-shown, and element visibility (IntersectionObserver), plus session-level signals: zero-interaction sessions, exit reason (`idle` / `nav-click` / `back` / `left-browser`), and time-per-step with active/idle split. P2 "derived" signals (rage clicks, dead clicks, form abandonment) are computed at report time (M7), not captured raw.
- **Hover/dwell, resize/orientation, and text selection stay DEFERRED** (resolving the earlier doc conflict in favour of the M3 model — the older M4 one-liner that mentioned "hover dwell time" is superseded by this decision).
- **Rendering = capture-all, visualise mouse-move + scroll (two options each, choose the winner).** Build capture for every in-scope event. For the two visualised types, M4 ships **both** candidate renderings behind a viewer toggle, on the same captured data: **mouse-move = density heatmap + path trails**; **scroll = fold line + colour-gradient-by-depth**. The user evaluates on real data and picks the better one; the loser is dropped before M4 close (or deferred to M6 if still useful). Field-level and visibility events are stored and queryable via the M3 query API but their dedicated visualisations are deferred to the M6 dashboard / M7 report.
- **Agent refresh precedes Part 6 (agreed 2026-05-24).** Before any Part 6 rendering code, the two scope-coupled agents that drifted behind M4 — `heatmap-qa` (stale capture/storage/finalize expectations) and `test-impact` (file→test map ends at Test 27) — are refreshed to M4, because both touch the rendering work. The broader agent review still runs as a Part 8 close gate. See `ARCHITECTURE_OVERVIEW.md` → M4 Part 6 prerequisite for the exact fixes.
- **Viewer toggle UI = nested type → style (agreed 2026-05-24).** Each event type is its own view on a step's heatmap — only one shows at a time (mutually exclusive overlays). The heatmap page shows top-level **type** toggles: **See clicks** (default), **See mouse moves**, **See scrolls**. Selecting a type that has two candidate styles (mouse-move, scroll) reveals a second row of **Style 1 / Style 2** buttons; **clicks** has no style buttons (one style). The style buttons are kept plain/minimal on purpose — they are temporary (the losing style is dropped in Part 7). The **clicks** view is the default when no type is selected (URL with no layer param), which keeps the click-precision tests (7–10, 17) valid. The existing **Desktop / Mobile** toggle is independent — it stays as-is and combines with any type/style. (Step is still chosen via the checkout page's Heatmap dropdown, which opens the heatmap for that step.) Combining two layers on one map is explicitly out of scope — recorded as a post-MVP idea (see "Potential post-MVP items" → Combined heatmap overlay).
- **Mouse-move sampling default = ~1 sample / 100 ms (≈10 Hz), 100% of sampled visitors** (Option A). Good path fidelity at modest volume for the POC; tunable later. Throttling is time-based and gated by the per-event-type enable flag. (Mechanism per `SCALE_DESIGN.md` §4.2; this pins the default value.)
- **Batching + sampling are built in M4** (client ring buffer + beacon/keepalive flush; batch ingest endpoint with multi-row INSERT; visitor-level cookie gate; effective `samplingRate` stored per session) — exactly as designed in `SCALE_DESIGN.md`.
- **Per-event-type default = all ON.** Every in-scope event type (including mouse-move and visibility) is enabled by default in M4 so the full pipeline can be exercised manually. Captured POC data is throwaway and cleared after manual testing (consistent with the "POC data is throwaway" principle). Per-type enable/disable config UI remains M6.
- **Fix interactive step navigation (pulled in from tech debt).** M4 will make the checkout CTA advance the visitor step→step in normal (non-tour) mode, lifting the existing "No interactive path to Delivery/Pay" debt. This is what produces real `completed`/`advanced` outcomes (so `outcome` detection is no longer an open question — completers occur naturally when a visitor advances). **Acceptance requirement:** for every step, when all mandatory fields are valid, a **single** CTA click advances to the next step — no double-click. (A case needing two clicks was observed; M4 must verify and fix this across all steps, with a regression test.)
- **Visitor-level internal sampling default = 100%** (track every visitor). Best for the POC — maximum data, simplest path. The sampling *mechanism* (cookie-persisted per-visit decision) is still built in M4 so it can be exercised; the rate lives in code/env config (the dashboard control is M6). Effective `samplingRate` is stored per session regardless.
- **Outcome semantics = step-only, no new tracking.** `advanced` = the visitor moved on to the next step; `completed` = the visitor reached/advanced past the final step (pay). M4 does **not** instrument the thank-you page. But the event + outcome model and the step list must keep thank-you **cheap to add later** — a future `thank-you` step and a purchase-completed signal should slot in without rework. (The "Thank-you page not covered" tech debt stays deferred, now with this readiness constraint.)
- **Part 8 winners chosen (2026-05-24) and PORTED — Chunks A–F done (2026-05-25), suite 53/53 green.** Evaluated on simulated aggregates (throwaway sim pages, now deleted). The chosen renderings below are implemented in `app/checkout/[sku]/heatmap/page.jsx` (+ the click-dot sites in `components/prototype/shopRuntime.js` and the note slot in `components/prototype/TopBar.jsx`): click opacity-by-count, scroll green colour-by-depth + legend, mouse-move volume-aware trails + top-bar note. The density + fold-line overlays and the whole `?style=` toggle are removed (one style per type), the temp `?nv=` code is gone, and the three sim pages + `.sim-shots/` are deleted.
  - **Mouse-move = path trails.** Rendered over the real step with **translucent** lines so the step elements stay visible under the paths. The **density** style is dropped.
  - **Scroll = colour-by-depth.** A single **green** hue as a **translucent tint** (alpha by % of sessions reaching each depth; not a multiply blend, so the step shows through) with an **inline legend** — labels inside the map at the depth each shade marks, reading "<n>% saw it". The **fold-line** style is dropped.
    - **Cumulative semantics ("% who saw each depth").** The alpha/shade at any depth D = % of sessions whose **maximum scroll reached at least D**. The top of the page is always 100% (every visitor sees it on landing). Colour gets lighter as depth increases, because fewer visitors scroll that far. Example: Visitor 1 scrolls to the very bottom; Visitor 2 scrolls to 30% then drops. Result: the band from top to 30% = **100%** green (both visitors reached it); the band below 30% = **50%** lighter green (only Visitor 1 went there). This is powered by the `scroll_depth` field captured in M4 — **not** by the `element-visible/element-hidden` events, which are a separate per-element exposure signal (visualisation deferred to M6/M7).
  - **Clicks = opacity-by-count (added 2026-05-25).** The click view stays precise per-element dots (unchanged positions/radius, so the 10px precision rule + tests hold), but each dot's red **alpha now scales with click count** so the busiest spots read as more prominent. Chosen over blue→red hue ramp, radius+colour, and a blurred density cloud (the cloud, "Option 4", loses per-element precision — kept as a documented post-MVP idea, not built). M1's "radius-only, colour later" deferral is now this.
  - Both losing styles and the per-type **style toggle** are removed (each remaining view has one style). Rendering tests 31/39/42/43 update accordingly.
  - **Visual confirmation done (2026-05-25)** via the throwaway sim pages: (a) trails over the real step are legible only at a **low, volume-aware alpha** (~0.06 at 1000 sessions; the renderer's 0.5 is a solid blob at volume) — the port must lower it; (b) click mapping at 1000 sessions lands correctly on elements; (c) clicks adopt opacity-by-count (above). **All pre-port decisions are now resolved.**
  - **Floating elements (sidebar + chatbot) — decided 2026-05-25: leave trails as-is + a header note.** Trails render in surface coordinates, but the **order-summary sidebar + chatbot icon are `position: fixed`**, and mouse-moves store only `x/y` (no element link). So trails near them show **approximate right-side activity**, not pointing glued to the element (horizontal is reliable; vertical smears with scroll). Accepted for the POC (clicks already map fixed targets exactly; moves are not changed). The proper fix (tag moves with the fixed element at capture) is **deferred** — see Tech Debt → Non-critical.
  - **Header note (moves view) — decided 2026-05-25.** A short, subtle **yellow** caption (~30% smaller than the current note), placed **to the right of the shop logo in the top bar** (heatmap screens only, via an optional top-bar slot; the live shop is untouched). **Different per screen:** desktop = "Summary & chat float on screen, so right-side trails are approximate."; mobile = chat-only wording (no "right side"). Stacked below the existing mobile finger-movement disclaimer.
  - **Scroll handling — no change needed (2026-05-25).** Moves/dots are stored at true full-page positions, so the viewer scrolls normally and maps correctly; no zoom-out/fit-page view is required (possible future toggle only).
  - **Manual visual-check fixes (2026-05-25).** Eyeballing the ported heatmap at volume surfaced two rendering defects, both fixed in `app/checkout/[sku]/heatmap/page.jsx`:
    - **Click dots — one shared screen-wide scale.** Dot size + opacity were normalised **per group** — surface dots and `position: fixed` dots (sidebar, chatbot) were scaled to **separate** maxima — so a fixed dot with twice the clicks of a surface dot could look identical. Fix: a **single `maxCount` across both groups** drives radius and alpha, so a busier dot always reads hotter anywhere on the step. Positions/radius rule unchanged → click-precision tests still hold (`buildAnchorAwarePoints`).
    - **Mouse-move / scroll — render in the capture-time layout.** Trails drifted **upward**, the gap growing down the page. Cause: the viewer renders personal-info **fully expanded** — validation errors forced on (`showPersonalInfoValidation`) and accordions open (`heatmapMode`) — but visitors moved against a shorter layout, so elements sit lower at render than at capture. Clicks survive (re-anchored to their element); trails are raw surface `x/y` with no anchor, so they stay at the captured `y`, landing above the pushed-down elements. Fix: render the **moves and scrolls views** with validation off + accordions collapsed (match the common capture state); the **clicks view** stays expanded (it needs the error elements to anchor to). Residual recorded under Tech Debt → Non-critical.
    - **Sessions never separated — visibility events counted as activity (capture-side, found 2026-05-25).** Symptom: repeated visits to the same step+sku always merged into **one** ever-living `in-progress` session; waiting out the 30s window didn't help. Root cause (diagnosed via temporary capture logging): the `element-visible` / `element-hidden` IntersectionObserver events ran through `scheduleFinalize` → `touchResume`, which reset the inactivity timer **and** refreshed the resume "last seen" clock. Those observer callbacks fire on their own (and thrash), so the session never idled out and the resume window never lapsed — every return resumed the same id. This contradicts the documented idle rule (no clicks/typing/scrolling/movement — visibility is **not** activity). **Partial change made in M4 (NOT a full fix):** visibility events are still **recorded** (attention data intact) but no longer reset activity (`recordSessionEvent(..., { resetActivity: false })` in `checkoutHeatmapClient.js`); user-driven field events still do. **This alone does not resolve the merge** — the reproducing test (Test 44, `test.fixme`) shows at least one more passive source still refreshes the resume clock. **The full fix is deferred to M5 as its first task** (see Future Milestones → M5 scope). Also deferred there: visibility-observer thrashing and zero-click sessions never finalizing (resume ref never cleared) — Tech Debt → Non-critical.
  - Full implementation/close detail in `ARCHITECTURE_OVERVIEW.md` → M4 Part 8.
- **Stored `in-progress` outcome (added 2026-05-24, built in Part 6).** A session that has started but not yet resolved is stored with `outcome:"in-progress"` rather than `null`, so an active/unfinalized session reads as an explicit state (DB + API), not empty. It resolves to `advanced`/`completed` (success) or `abandoned` (drop-off, applied lazily by the sweep). Built in Part 6 (see `ARCHITECTURE_OVERVIEW.md` → M4 Part 6 for the upsert/sweep guards).
  - **`in-progress` may co-exist with an `exit_reason` — kept as-is by design (decided 2026-05-24).** When a visitor leaves the page, the exit beacon records *how* they left (e.g. `left-browser`) but the session stays `in-progress`, because they may return within X. If X elapses with no return, the sweep finalizes it (`abandoned`) and keeps that `exit_reason`. So a row showing `in-progress` + `left-browser` is not a contradiction — it means "visitor left the page; not yet finalized; may still return within X." No code change; documented in `DATA.md` → `exit_reason`.
- **Session resume on return within X (session lifecycle).** A step visit is not a brand-new session every time. If a visitor leaves and then returns within a configurable window **X** (default **30s**; **2s for autotests**), the **same** session resumes — same session ID, events keep appending. Only after X passes with no return does the session finalize. Implications: (1) the session ID must persist across the leave/return gap (cookie/`sessionStorage` + a "left-at" timestamp); (2) finalize cannot happen on exit — it is deferred until X elapses with no return, so finalization moves **server-side** (a timeout sweep), since a closed tab cannot run its own timer; (3) the exit beacon flushes buffered events but does **not** close the session. This refines the M1/M2 "every step open = a new session" rule for M4 and resolves the zero-interaction trigger question below. **POC = single short X only;** the model is kept open (no work now) to external re-entry (drop-off email / Account Dashboard) and the longer "abandoned-but-reopenable" two-window behavior built at M8 — see `FUTURE_THIRD_PARTY_INTEGRATION.md` → "Session resume and external re-entry".
- **Finalize is lazy; the signal is step completion (clarified 2026-05-24).** What we need to know is whether the visitor **completes the step within X**, not whether they return. (a) **Completion = success**, recorded the moment they advance/complete (Part 1 already emits `advanced`/`completed`); after a leave, time-to-complete = completion timestamp − tab-close timestamp. (b) **No completion within X = dropped off.** (c) **Return is observable** — events arriving after the tab-close beacon on the same persisted session ID mean they came back; within X they append to the same session, after X they start a **new** session and the prior one stays dropped off (fine for the POC). (d) **No real-time timer/cron** — there is no always-on runtime (local dev; Vercel deferred to M8), so the dropped-off state is **derived from timestamps** when the data is next read/queried or when the next request triggers an opportunistic sweep; a dedicated sweep endpoint lets tests/manual checks force it. Applying the label lazily (not at the instant X expires) is acceptable for the POC.
- **Movement = desktop-only IN PARTS 1–6; mobile finger-movement is scheduled for the next part (revised 2026-05-24).** Through Part 6, mouse movement is captured on desktop only; mobile records scroll depth + taps but not finger movement. **This is now being changed:** the next part (Part 7 scope — see `ARCHITECTURE_OVERVIEW.md` → M4 Part 7) will capture **finger movement on mobile** via `touchmove` (throttled ~10 Hz), recording the finger's surface-relative path. It **intentionally includes scroll swipes** (scroll *depth* keeps its own capture + its own "See scrolls" view). It renders in the existing **"See mouse moves"** view (name unchanged) and the **mobile** heatmap shows a short, mobile-only header disclaimer: *"On mobile there's no mouse — here you see finger movements that include scrolling. See details for scrolling on a separate view."* This supersedes the original "movement = desktop-only" decision and resolves the "mobile touch-move not captured" tech-debt item. (Desktop stays mouse-movement; only mobile changes.)
- **Part 2 transitional model (2026-05-22).** Part 2 changes transport only: route capture through the new batched `/ingest` pipe, but **keep finalize client-side on inactivity** (the existing drop-off → `outcome:"abandoned"` flow). Server-side deferred finalize + session resume stay in **Part 5**. The legacy `POST /api/checkout-heatmap` write path is **kept for back-compat but no longer called by the client** (capture writes via `/ingest`; `GET`/`DELETE` unchanged). Keeps Part 2 small and the existing tests green.
- **Part 4 capture decisions (2026-05-23).**
  - **Field events store no raw values.** We never record the text a visitor types. The integration target (Autohero) already captures and persists input values at its own layer, so duplicating that is out of scope and avoids handling PII (names, phone, card). We record only the behavioural signal per field: which field anchor, and whether it was **completed** (visitor could proceed) vs left empty so a **mandatory-field validation triggered**. `detail` carries the field anchor id + a filled/empty indicator (e.g. value-present flag and/or length) — never the value itself.
  - **`field-change` fires on blur/commit, not per keystroke.** `field-focus` on entering a field, `field-blur` on leaving, and `field-change` recorded at blur when the value changed — roughly one change event per edited field. Captures "was the field completed" without high-frequency keystroke volume.
  - **Element visibility = per-element exposure time, for all tracked elements.** Goal: know how much of a session a visitor spends viewing each area of a step. The landing view is always seen on render; we need to distinguish "stayed on the initial view the whole time" from "scrolled down, dwelled mid-page, then reached the footer." For every tracked (scanned) anchor, record `element-visible` (crossed ≥50% on screen) and `element-hidden` (dropped back below 50%) with timestamps; summing per element gives visible duration per area across the session. **Watch all tracked elements, not a subset.** The "seen" threshold is **≥50% visible** — a tunable heuristic (chosen 2026-05-23). Every visible/hidden event is stored raw so an Autohero data engineer can query which areas are seen the most. The dedicated attention/exposure heatmap that visualises this is **deferred to M6/M7** — M4 only captures + stores; M4-rendered heatmaps stay clicks + mouse-move + scroll.

#### Step outcome — business rules (plain language)

When a visitor is filling in a checkout step and then leaves — closing the tab or navigating away — we do not immediately treat that as a failure. What matters is whether they finish that step, not whether they happen to come back. A visitor can leave and return any number of times; that movement does not count on its own. The only thing that turns a step into a success is the visitor actually completing it and moving on to the next step.

So each step has two business outcomes. If the visitor completes the step, it is a **success** (recorded as `advanced`, or `completed` at the final step). We keep the time they first left and the time they finally completed it, so we can measure how long it took — including any time spent away. If the visitor never completes the step, they have **dropped off** at that point (recorded as `outcome: "abandoned"`), and that is where we lose them.

We give the visitor a grace window of **30 seconds** (2 seconds in automated tests) to come back and continue where they left off. Return within that window and it is treated as the same visit, picking up where they were. Return later than that and it counts as a fresh start — the earlier attempt stays a drop-off, even if they eventually finish on the new visit. For this prototype, that simplification is acceptable.

*Note on the timing values.* The **30 seconds** (and the **2 seconds** used in automated tests) is a deliberately short placeholder so behaviour is quick to exercise. In a real product the timing windows — the grace/resume window **and** the idle threshold for the active/idle split — would be much longer, **more than 24 hours**. The value is configurable; only the placeholder is short.

#### How a visitor leaves a step (exit reason) — business rules (plain language)

Whenever a visitor leaves a step without finishing it, we record not just *that* they left, but — as best we can — *how* they left. This helps later: for example, spotting that many people abandon one step by closing the tab outright, while on another they just drift away idle.

There are four ways we recognise:

- **Idle** — they simply stop: no clicks, typing, scrolling, or mouse movement. After 30 seconds of nothing (and no completion), we treat them as gone. "Idle" also quietly covers things we can't see directly — they walked away, their phone went to sleep, and so on. We don't need to know which; the silence is enough.
- **Clicked away on the page** — they clicked something on the step that takes them elsewhere: an external link, the backpack image, etc. Because that click happens on our page, we can see it and record exactly which element sent them off.
- **Back button** — they used the browser's back button. We can catch this in most cases and record it on its own (best-effort).
- **Left via the browser** — they closed the tab or window, typed a new address, used a bookmark, or the system shut the tab down. These all look identical to us, so we record them together as one reason.

**Guiding principle: separate the triggers as finely as we can.** We want each distinct way of leaving recorded on its own, never blurred together. So every on-page element that can send a visitor away is identified individually (which link, which image, which breadcrumb), and any such element not already tracked by our click recording gets a small tag — so an on-page exit is never dumped into the catch-all "left via the browser" bucket. Only the cases we genuinely cannot tell apart (closing the tab vs typing a new address vs the system killing the tab) stay combined.

**A refresh/reload is not leaving.** The visitor reloads and lands back exactly where they were, so we treat it as if they never left — the idle clock keeps counting from their last real action. Only a full 30 seconds with no real activity and no completion counts as a drop-off.

**The chatbot icon does not count as leaving.** It's clickable, and later it will open a small chat window, but it never closes the step — so clicking it is never treated as a walk-away. The Heatmap and Clear-data buttons are tools for us during development and won't exist for real visitors, so they're ignored entirely.

**Two things we'd like, but can only do partly:** detecting that a visitor lost internet, and detecting that the app itself crashed. Both are limited — if someone is offline we usually can't send the information until they reconnect, and a full browser crash leaves nothing to record in the moment. These belong to a separate logging / health-monitoring effort we'll set up later (see Tech Debt → Non-critical), not to this step's behaviour tracking. For now, a lost connection or a crash simply shows up as "idle" or "left via the browser."

#### Implementation notes to confirm in Part 1 (not scope-blocking)
- **Zero-interaction recording trigger — RESOLVED** (see "Session resume on return within X" above). A no-interaction visit is committed on exit (`pagehide`) and finalized only after the X grace window passes with no return. Drives Test 1 / Test 36 assertions.
- **Default heatmap view stays click-dots** — the new mouse-move/scroll views are toggled, so click-precision tests (7–10, 17) remain valid.

### M5 — Login Step and Individual Session Attribution
Add a lightweight login step between the Details and Personal Information screens. The visitor enters a name and optionally a password. Completing this step creates a named, unique session so that all subsequent actions on that visit can be attributed to a specific individual. This enables per-visitor analysis and filtering in later reporting.

> **STATUS: CLOSED (2026-05-26). Parts 1–3 delivered. 58/58 active tests passing. All close gates met (`milestone-doc-review`, tech-debt review, agent review, `FUTURE_THIRD_PARTY_INTEGRATION.md` reviewed, `milestone-prereqs` → READY).**

**M5 scope — added work (2026-05-25):**

1. **FIRST TASK — Fix the session-merge bug (deferred from M4). DONE (2026-05-26).** Tests 36 + 44 un-skipped and green (54/54 suite green). *Do this before the login-step work — it touches the same session lifecycle.*
   - **Symptom:** repeated visits to the same step+sku collapse into **one** ever-living `in-progress` session; the heatmap/DB show only one session no matter how many separate visits, and waiting out the 30s window doesn't help.
   - **Diagnosed (2026-05-25):** the resume window + inactivity timer are refreshed by `scheduleFinalize` → `touchResume` on every "activity", but **non-user / passive events count as activity**, so the session never idles out and every return resumes the same id. Confirmed contributors: `element-visible`/`element-hidden` (IntersectionObserver, which also **thrashes**). Ruled out (not the cause): server merge (`sessions` PK is `id`, `ON CONFLICT (id)`), read-path collapse (`GROUP BY s.id`, no limit), and the resume-window check itself (correct — verified in isolation: `loadResumableSessionId` returns null once `now - lastSeen > windowMs`).
   - **Where the clock is refreshed (all in `lib/prototype/checkoutHeatmapClient.js`):** `touchResume()` runs on mount AND inside `scheduleFinalize()`. `scheduleFinalize()` is called from `handleScroll`, `bufferEvent` (scroll + mouse-move), `handleActivity` (focusin / keydown / input / change), `updateInteraction` (clicks), and `recordSessionEvent` (field events + — until the M4 partial change — visibility). The resume window value is `getCheckoutHeatmapInactivityMs` = 30s manual / 2s autotest; the ref store is `checkoutHeatmapResume.js` (localStorage). Audit these call sites and gate out any non-deliberate source.
   - **Evidence (from this diagnosis):** on each return the `MOUNT` log read `RESUMED` with `ageBeforeMount` ~5s (never >30s) even after a 35s wait, because `element-visible`/`element-hidden` fired in bursts during the "idle" and each kept resetting the clock. The same id (e.g. `…04d7ae36`) persisted across reload, Clear-data, and tab close.
   - **Partial change already in M4 (kept, insufficient alone):** visibility events no longer call `scheduleFinalize` (`recordSessionEvent(..., { resetActivity:false })` in `checkoutHeatmapClient.js`). The reproducing test (**Test 44**, `m4-session-signals.spec.ts`, currently `test.fixme`) shows the merge **still happens** after this change. **Root cause identified (2026-05-26):** the M4 fix only skipped the timer reschedule, but `recordSessionEvent` still calls `appendCheckoutHeatmapEvent`, which updates `lastInteractionAt`. `isCheckoutHeatmapDropOffCandidate` reads `lastInteractionAt` to decide whether to finalize — so visibility events keep the session looking active, it never finalizes, `clearResumeRef` is never called, and the resume ref stays in localStorage. Every return within the window resumes the same session. Scroll and mouse/finger move are **not** the culprit — they are deliberate visitor actions and must keep the session alive (see activity definition below).
   - **Recommended fix (updated 2026-05-26):** Two changes needed. (1) **Exclude visibility events from `lastInteractionAt`:** in `recordSessionEvent`, when `resetActivity:false`, do not pass the event through `appendCheckoutHeatmapEvent`'s interaction update — visibility events are stored but must not touch `lastInteractionAt` at any layer. (2) **Drop the `≥1 click` finalize gate:** remove the `hasClicks` check in `saveSession`; any real activity (scroll, move, type, click) is sufficient to save a session. Use a **diagnostic-first approach**: un-skip Test 44, watch it fail and confirm the exact failing path, then fix. Then un-skip Test 36 and verify that too.
   - **Also enable Test 36 (remove `fixme`) when the fix lands.** Test 36 (zero-interaction bounce) was failing at M4 close (2026-05-26) because zero-click sessions never finalize — `clearResumeRef` is only called on finalize, which requires ≥1 click (M1 rule). **This gate is removed in M5 (Option C, agreed 2026-05-26):** any real activity (scroll, move, type, or click) is sufficient to save a session as a drop-off. Drop the `hasClicks` check in `saveSession`; Test 36 must pass once the full fix lands. See `TEST_CASES.md` → Test 36.
   - **Activity definition and session lifecycle rules (agreed 2026-05-26):**
     - **What counts as activity (resets the idle countdown):** click, tap, scroll, mouse/finger move, typing, field focus/blur/change. Any of these keeps the session alive and restarts the X-second idle timer. These events are always recorded and always mapped on the heatmap.
     - **What does NOT count as activity:** `element-visible`/`element-hidden` signals (IntersectionObserver). These are recorded for data (per-element exposure) but must not restart the idle countdown or touch `lastInteractionAt`.
     - **Session ends (drop-off):** the visitor does nothing — no clicks, no typing, no scrolling, no mouse/finger movement — for X seconds (30s live, 2s autotest). The session finalizes as a drop-off.
     - **Session resume:** visitor returns to the same step within X seconds → same session resumes. After X → new session starts. Visits stay separate and are never merged.
     - **Zero-click visits must be saved (Option C, agreed 2026-05-26):** any real activity (scroll, mouse/finger move, typing, or click) is sufficient to save a session. The M1 `≥1 click` gate is removed in M5. A visitor who only scrolls then goes idle for X is a drop-off and must be recorded.
   - **Future report data need (M7):** sessions must be distinguishable by their interaction type — e.g. visitor only scrolled (no clicks), only moved mouse (no scroll or clicks), or did nothing at all. Scroll + mouse-move events must always be recorded for these report sections to be possible. Planned for M7.

2. **Model-selector helper agent. BUILT (2026-05-26).** A repo agent that, given the task at hand, recommends which model to switch to (Opus for hard reasoning/architecture/tricky debugging, Sonnet for everyday coding, Haiku for simple/fast edits) and how to switch (`/model`). **Open decisions resolved at build:** scope = **project** (`.claude/agents/model-selector.md`, not user-global); tier mapping = **3-tier** (Opus/Sonnet/Haiku). **Runs automatically:** `CLAUDE.md` instructs the main session to apply the tier mapping at the start of each task and surface a one-line switch suggestion only when the current model is not the best fit (no noise when it already fits); can also be invoked explicitly. The agent itself runs on Haiku and does not log to `AGENT_RUN_LOG.csv`. Catalogued in `AGENTS.md`. Not heatmap-specific — a workflow helper.

3. **Login step feature — FULLY SPECIFIED (2026-05-26).** Lightweight login screen inserted as the first step in the checkout flow (before Personal Information). All decisions agreed:
   - **UI:** two fields only — login name and password (optional, purely cosmetic). No fancy UI/UX required for the POC.
   - **Login name field:** required — must be non-empty to proceed. No format validation (any text accepted). Password is optional and purely cosmetic; no validation.
   - **CTA label:** "Continue" (consistent with the rest of the checkout flow).
   - **Placement:** first step in the checkout flow (`step=login`), before Personal Information. A real step in the flow structure, not a standalone route.
   - **Step nav / breadcrumb:** the login step does NOT appear in the checkout step indicator. The nav continues to show Personal Information | Choose Delivery | Pay & Finish only.
   - **Heatmap capture in POC:** NOT captured. The login step is not tracked by the heatmap in the POC. Built as a real step so capture can be added cheaply at Autohero integration (same "cheap to add later" pattern as the thank-you page).
   - **Visitor identity model:** at login completion, generate a unique visitor ID (do NOT use the entered login name as the identifier). Tag all subsequent sessions (personal-info, delivery, pay) with this visitor ID for attribution. The entered credentials are ignored in the POC — we do not validate them. The attribution plumbing (visitor ID on sessions) must be integration-ready for Autohero, where real credentials and identity will matter.
   - **Visitor ID storage (POC):** stored in localStorage. Survives tab close, which is required so resume-within-X retains attribution when the visitor briefly leaves and returns. A new ID is minted at every login completion — no reuse of a prior localStorage value. Real product: localStorage is a POC stand-in only; the real product uses server-side identity (account-based), which is cross-device. See `FUTURE_THIRD_PARTY_INTEGRATION.md` → M5.
   - **visitor_id in DB vs API:** `visitor_id` is stored in the `sessions` DB table (new nullable column). It is NOT exposed via the query API in M5 — DB-only for now. Direct DB queries are sufficient for any per-visitor outlier analysis in the POC. API exposure deferred to a later milestone.
   - **Session resume for logged-in visitors (agreed 2026-05-26):** resume-within-X still applies after login. If a logged-in visitor leaves Personal Info and returns within X (30s in the POC; much larger in the real product), the same session resumes — visitor attribution stays intact on resume. Login does not force a new session on return; it only sets visitor identity on first arrival.
   - **Design + build sequencing (agreed 2026-05-26):** implement the bug fix first (done). The login step sits on top of the clean session model.

### M6 — Admin Dashboard
Add an admin dashboard (access-controlled, link-based) where an admin can configure: which checkout steps the heatmap covers, which element types are tracked (dropdowns, text fields, buttons, etc.), and the timeframe the heatmap and reports should cover. The dashboard should also surface heatmap views, raw data access, and report generation.

#### Decisions agreed (2026-05-27)
- **Dashboard auth:** secret link with one shared token stored in env config. Token protects both the dashboard page and API routes (config save, raw data export).
- **Revocation:** rotate the env token; everyone loses access. Admin generates new link and re-shares with relevant people.
- **Dashboard layout (agreed 2026-05-27):** a **single page**, scrolled top to bottom, with three stacked sections **in this order**: (1) **Data** — the data-recording config, framed as *setting the scope of the inputs* that both the heatmap and the report draw from; (2) **Heatmap** — the viewer filters + open-in-new-tab button; (3) **Report** — the placeholder button. No tabs. The order reflects the data flow: define the input scope first, then view it as a heatmap, then generate a report from it.
- **Dashboard visual style / UI details (agreed 2026-05-27):**
  - **Feels part of the product** — reuse the Shop's existing styling (colors, fonts, components), not a separate plain admin look.
  - **Heatmap icon** styled like the reference image provided (a soft green/yellow heatmap blob with red hotspot dots). The **hotspot dots "breathe"** — a subtle pulse animation, growing and shrinking.
  - **Desktop / mobile selector = icons** (a desktop icon and a mobile icon), not text buttons or radios.
  - **Single-choice selections = dropdowns** — checkout step, view type (clicks / moves / scrolls), outcome filter, and sampling-rate preset are all dropdowns. (Dropdowns preserve the single-select / mutually-exclusive behavior already agreed.)
  - **Multi-select capture controls stay checkboxes/toggles** — which steps, element types, and event types to capture are multi-select, so they remain checkboxes/toggles (a single dropdown doesn't fit multi-select). *(Assumption recorded 2026-05-27; revisit if a different widget is wanted.)*
  - **Section headers** (Data, Heatmap, Report) rendered in a **larger, bold** font.
  - **Narrow, centered layout** — the dashboard does not span the full screen width.
  - **Desktop-only** — the dashboard UI targets desktop screens only; no responsive/mobile layout for the dashboard itself. (Separate from the heatmap's desktop/mobile *capture* views, which are unaffected.)
- **Report generation:** placeholder button in the dashboard in M6. Real report wired in M7. Button text: "Generate Report" or similar; action: disabled/not-yet-implemented message.
- **Data recording configuration section:** user configures on dashboard what data is captured. 8 config items: (1) checkout steps (checkboxes: personal-info, delivery, pay) — **unticking a step actually stops capture for that step** (same enable/disable-affects-capture model as element types and event types); a step with no captured data shows the no-data message in the viewer, (2) timeframe — **capture window**: the date range during which data is recorded (a separate setting from the viewer timeframe below), (3) drop-off definition (X seconds inactivity—display only, not editable in M6), (4) element types — admin can **enable/disable each type**, and disabling actually **stops capture** for it (real runtime config, not view-only; fulfills the M2-deferred "enable/disable via dashboard without code changes"). Types are still auto-discovered by the M2 scanner (per ARCHITECTURE_OVERVIEW.md); the dashboard adds a per-type on/off state stored as runtime config, (5) event types — admin can **enable/disable each type** (clicks, mouse-move, scrolls, field interactions), and disabling actually **stops capture** for it (real runtime config, not view-only; same model as element types), (6) sampling rate — **visitor-level % is admin-settable** via presets **1% / 10% / 50% / 75% / 100%**. Selection mechanism is already built (M4, `checkoutHeatmapSampling.js`): a **random per-visitor coin flip** (`Math.random() < rate`) decides in/out, **persisted in a cookie** (`m1.heatmap.sampled`, 30 days) so a visitor is **sticky** — fully recorded or fully skipped across reloads and all checkout steps, keeping drop-off funnels complete. Extremes are exact (0% = always off, 100% = always on). **M6 work:** move the rate from env config (`NEXT_PUBLIC_HEATMAP_SAMPLING_RATE`) to dashboard runtime config (same store as the element/event toggles); visitors with an existing cookie keep their decision, new visitors get the new rate (acceptable for POC). **Event-level throttle** (mouse-move ~10 Hz) stays a code default, **display-only** in M6 (not admin-editable), (7) desktop / mobile (both captured, toggle which to view), (8) clear data button — **wipes ALL recorded data** (every step, view, and timeframe — not a filtered subset), behind a **confirmation pop-up**. The pop-up is the deliberate safeguard precisely because the action is destructive and total. Matches today's clear-data behavior.
  - **Save model (agreed 2026-05-27):** data-section edits are **staged** and take effect only when the admin clicks **Save** — changing a toggle does not alter capture until Save is clicked. One Save applies all staged data-section changes (steps, element types, event types, sampling rate). **Clear-data is exempt** — it is its own immediate action behind its confirmation pop-up, not part of the Save staging.
- **Header buttons removed from the Shop and migrated to the dashboard (agreed 2026-05-27):** all on-page heatmap controls currently in the Shop header (the **Heatmap** button/step dropdown, **Clear data** button, desktop/mobile toggle, See clicks/moves/scrolls, plus the pending move/scroll header note) are **removed from the Shop page** in M6 and live **only** in the admin dashboard. **This is an explicit M6 implementation task** — delete the header controls from the Shop UI, not merely hide them. **Access control:** these are admin tools, reachable only via the secret dashboard link; **visitors must never see them** on the Shop. After M6 the live Shop renders with no heatmap/admin UI at all.
- **Mobile scope clarification:** "mobile view" = responsive web (same browser, different widths; desktop/mobile views both render in `localhost:3000`). Native mobile apps not in scope for POC. Heatmap captures both desktop and mobile viewport sizes; viewer toggles which to display.
- **Heatmap viewer configuration (on dashboard):** user selects heatmap view parameters. The **no-data message** applies to *any* selection combination (step / view / timeframe / outcome) that has no captured data — e.g. selecting a step that was never recorded (or had capture disabled in the data section) shows the message. Items: (1) checkout step (dropdown: personal-info, delivery, pay), (2) desktop / mobile (icon selector — desktop icon / mobile icon), (3) view type (dropdown: clicks, mouse-moves, scrolls), (4) timeframe — **admin-selectable view window**: the admin picks a date range to view the heatmap for. If the selected range falls outside the data actually captured (per the data-section capture window), show a "No data for this range" message. This is a **separate setting** from the data-section capture window (item 2) — capture window = when data was recorded; view window = what slice the admin wants to see, (5) outcome filter (dropdown, single-select: all sessions / drop-offs only / completers only). All config persisted as URL params on link-out.
- **Outcome filtering:** a display-only filter (no capture change). Outcome is recorded on all sessions (M3+) but the heatmap currently shows all sessions mixed. M6 adds outcome filter to viewer. Outcome unknown until session ends; to measure completers-vs-drop-offs, must record all sessions and filter on view. Outcome is a real feature requiring code (aggregation change), not just a UI toggle.
  - **Filter value → stored outcome mapping (agreed 2026-05-27):**
    - **"Drop-offs" = `abandoned`** sessions only. This already bakes in the grace-window logic: a visitor who left a step but returned within the X-second window (30s live / 2s test) resumed the same session and never became `abandoned`. The drop-off condition is: did some real activity (scroll / move / type / click), did **not** complete the step, and did **not** return within the grace window. The four exit reasons (`idle`, clicked-away, back-button, left-via-browser) describe only *how* they left, not whether it's a drop-off. Refresh/reload and chatbot clicks are not "leaving."
    - **"Completers" = `completed`** — the **single success outcome**, meaning "completed *this* step." Applies uniformly to every step including pay.
  - **Outcome model unified in M6 (agreed 2026-05-27).** The prior two success outcomes — `advanced` (passed steps 1–2) and `completed` (passed the pay step) — are **collapsed into one value `completed`** meaning "completed this step," applied the same way to every step. `advanced` is removed. **Why:** having two names for the same action (completing a step) was confusing, and the `completed`-as-final-step framing implied purchase tracking. **Purchase/conversion is explicitly out of scope** — the product cares only whether the visitor completed *this step*, never whether they bought (there is no real purchase check; the thank-you page is not instrumented). **M6 implementation task (touches built code, not just docs):** update the outcome-setting logic so every step writes `completed` on success (not `advanced`), relabel/migrate existing `advanced` rows in the DB, and update any tests asserting `advanced`/`completed`. Also update `DATA.md` and `ARCHITECTURE_OVERVIEW.md` outcome references.
    - **"All" = every session** — drop-offs + completers + unresolved `in-progress` sessions. Matches today's behavior (the heatmap currently shows all sessions mixed).
    - **The three options are mutually exclusive — a single-select radio:** Drop-offs | Completers | All. Exactly one is active; picking one shows only that set.
- **Heatmap surfaced — "apply filters → render" model (agreed 2026-05-27):** the heatmap-section controls act as **filters over already-collected data** (no capture involved). The admin sets the context — step, desktop/mobile, view type, timeframe (view window), outcome filter — then clicks a button that **opens the configured heatmap in a new browser tab**, same as today. Config is passed as URL params (`?step=...&view=...&type=...&from=...&to=...&outcome=...`), so the link is shareable/bookmarkable; every click applies the params. Unlike the data section, there is **no Save** here — the button simply renders the filtered result.
- **Raw data access — DROPPED from M6 (2026-05-27).** No raw-data export (file or in-dashboard table) is built. The backend engineer queries the Postgres `sessions`/`events` tables directly for any raw analysis. This narrows the product Scope item "raw data access / export" for the POC: the data lives in the DB and is query-accessible; a dashboard export UI is not needed. (Revisit at M8 integration if Autohero analysts need self-serve export — see M8 "Analyst DB access".)
- **Sampling is per-session, not per-visitor (corrected 2026-05-27).** The dashboard sampling-rate % is applied **per session** (one step visit), each sampled independently, because the product measures **per-step conversion** (entered step → completed step), not whole-journey funnels. This fixed a bug where intermediate rates (e.g. 50%) were never applied — any rate above 0 captured 100%, only 0% disabled. The per-visitor `m1.heatmap.sampled` cookie was removed; a new session flips its own coin at the effective rate (query-param → config → env → default), a resumed session keeps its decision, and 0%/100% stay deterministic. The probabilistic decision is client-side; the server ingest gate still enforces only 0%/step/window. Intermediate-rate probability is unit-test territory (see M6.2). **Tradeoff accepted:** per-session sampling can leave a visitor's journey partially captured (one step in, the next out) — fine here because the unit of analysis is the individual step, not the journey. See `SCALE_DESIGN.md` §4.1 for the coin metaphor and a 3-step worked example.
- **Capture-window date boundary fixed (2026-05-27).** A `to` date like "Today" was parsed as midnight UTC (start of day), so any timeframe preset closed the window for the rest of the day and the ingest gate silently dropped every session. Both gates — client `isCaptureWindowOpen` and the server ingest route — now parse `from` as local start-of-day and `to` as local end-of-day (`T23:59:59.999`).

#### Implementation flow (phased — 2026-05-27)
Six sequential parts, each ending with a manual check (same discipline as M2–M5). Full technical detail — files, the config-storage decision, and per-part manual checks — lives in `ARCHITECTURE_OVERVIEW.md` → "M6 architecture — admin dashboard". The two built-code tasks are sequenced to keep the suite green: the outcome rename lands first (with its test update); the Shop header removal lands last, after the dashboard provides the replacement path.

- **Part 1 — Outcome-model unification.** Collapse `advanced` into `completed` ("completed this step") across code, the DB (one-time relabel of existing `advanced` rows, both schemas), tests (Test 37), and docs. *Check:* finished steps read `completed`; no `advanced` rows remain; suite green.
- **Part 2 — Runtime config store + API + defaults.** Single-row `heatmap_config` table (Postgres — see the storage decision in `ARCHITECTURE_OVERVIEW.md`), config defaults = today's behavior, secret-token auth helper + `DASHBOARD_TOKEN`, public `GET` / auth-gated `POST` config endpoint. No UI yet. *Check:* GET returns defaults; authed POST persists across restart; unauthed POST rejected.
- **Part 3 — Capture reads runtime config.** Capture client gates on step / element-type / event-type / capture-window toggles (fail-open to defaults) and takes sampling rate from config (not env). *Check:* disabling a step/type stops its capture; re-enabling resumes; sampling honored.
- **Part 4 — Dashboard shell + auth gate + Data section.** `/dashboard?token=`, Shop-styled, narrow/centered, desktop-only; the 8-item Data section with staged edits + one Save; Clear-data behind a confirmation pop-up (immediate, exempt from Save). *Check:* valid token renders / wrong token blocked; Save changes capture; Clear-data wipes all.
- **Part 5 — Heatmap section + viewer outcome filter + timeframe.** Dashboard Heatmap section (step / desktop·mobile icons / view type / timeframe / outcome) opens the viewer in a new tab via URL params; the viewer gains the outcome filter (drop-offs/completers/all) and timeframe view-window. Breathing heatmap icon. *Check:* filters apply on open; outcome filter isolates `abandoned`/`completed`/all; out-of-range timeframe shows the no-data message.
- **Part 6 — Remove Shop header controls + Report placeholder + close.** Delete the header Heatmap/Clear-data/toggle/note from the live Shop (delete, not hide); add the Report placeholder button; rewrite Tests 2/3 onto the dashboard/API path; run close gates. *Check:* live Shop has no heatmap/admin UI; dashboard is the only entry; suite green; all close gates logged.

### M6.1 — Heatmap Simulation Mode (follow-up to M6)

> **STATUS: CLOSED (2026-05-28). All 3 parts delivered. 73/73 active tests passing (Tests 57–63 new, Test 54 updated). All close gates met.**

A dedicated **Simulation section** in the admin dashboard that lets the admin generate synthetic sessions and preview how the heatmap looks at volume, without real visitors.

**Hard constraints:**
- **Simulated data is stored separately from real data** — real `sessions`/`events` must never be mixed with simulated ones.
- **Discardable** — the admin can wipe the simulated set; real data remains fully intact.

**Decisions agreed (2026-05-28):**
- **Fixed session count: ~1500.** Not admin-configurable. Goal is "populated visualisations"; variable count adds UI scope with no clear POC benefit.
- **Isolation: separate `heatmap_sim` Postgres schema.** Same pattern as `heatmap_test` — discard = TRUNCATE the sim schema; zero risk of touching real data. (Ruled out: a `simulated` flag on existing tables — every query would need to filter it and a bug could mix data.)
- **Fixed simulation step: Personal Information only.** Both desktop and mobile, all three views (clicks / mouse-moves / scrolls).
- **Realistic outcome/exit mix (hardcoded):** ~65% `abandoned`, ~35% `completed`; exit reasons: ~50% idle, ~30% left-browser, ~15% nav-click, ~5% back; desktop/mobile split: ~60/40.
- **Capture toggles ignored.** Simulation generates the full dataset regardless of what capture config is currently on/off. Its purpose is previewing visualisations, not replaying the capture pipeline.
- **Viewer: reuse the real viewer.** Pass a param (e.g. `?schema=sim`) so the viewer reads from `heatmap_sim` instead of `public`. No separate sim view — no code duplication.
- **Admin-only access.** Same secret-token auth as the rest of the dashboard.

**Dashboard entry point — own Simulation section (separate from Heatmap):**
- Sits below the Heatmap section, above Report in the dashboard.
- Status line: "1,500 simulated sessions ready" or "No simulation data".
- Two action buttons: **Generate** (creates the sim dataset) and **Discard** (wipes `heatmap_sim`; real data untouched), Discard behind a confirmation pop-up.
- One **View Simulation** button — opens the viewer pointed at `heatmap_sim`, fixed to Personal Information. No step / timeframe / outcome controls shown (they don't apply to sim data).
- The viewer keeps its desktop/mobile + clicks/moves/scrolls toggles — these are view-time choices, not generate-time choices.
- The Heatmap section (real data) is unchanged — keeping real and sim clearly separate avoids confusion over which controls apply to which dataset.

**All 6 original open questions resolved (2026-05-28).** No remaining open questions.

**Anticipated tech debt** is recorded in the Tech Debt register → **Anticipated (M6.1)** above (one critical item — the `source`→schema allowlist; five non-critical). Architecture + phased implementation plan: `ARCHITECTURE_OVERVIEW.md` → "M6.1 architecture — heatmap simulation mode".

### M6.2 — Unit Test Foundation (follow-up to M6)
> **STATUS: COMPLETE (2026-05-28).** 54 Vitest unit tests across 4 files, all passing. No e2e changes.

*Idea captured 2026-05-27; sequenced **after M6.1 is complete**, before M7. **Scope frozen 2026-05-28** in a scoping session (decisions below). `milestone-start` is intentionally **skipped** — this is a follow-up to M6, not a new milestone.*

Introduce a **unit-test layer** (Vitest) to cover the **durable, pure-logic core**. No unit tests exist today — the suite is entirely Playwright e2e (`tests/e2e/*.spec.ts`). Motivated by two M6 bugs that were pure logic and slipped past the e2e suite: the **capture-window date-boundary** bug (`to` parsed as midnight UTC = start of day, so selecting "Today" closed the window for the whole day) and **intermediate sampling rates never applied** (any rate above 0 captured 100%; only 0% turned capture off).

**Frozen scope (2026-05-28, extended 2026-05-28):**
- **Target files — cover every business rule in each:**
  - `checkoutHeatmap.js` — normalize / finalize / drop-off candidate / step timing / scroll depth / view classification / radius scaling / aggregation.
  - `checkoutHeatmapSampling.js` — `resolveSamplingRate` (one of the two motivating bugs).
  - `heatmapConfigStore` — config defaults + merge.
  - `dashboardAuth.js` — `isAuthorizedToken` (missing/empty token, length mismatch, valid match) + `extractBearerToken` (header parsing).
- **Coverage approach:** rule-based, **not** line-percentage. List every business rule in the target files first; each rule gets ≥1 test. Line % is not a gate.
- **Tool:** Vitest (free, light, fits Next.js).
- **Location:** `tests/unit/*.test.ts` (mirrors the existing `tests/e2e/` layout).
- **Run workflow:** the standing unit+e2e convention lives in `AGENTS.md` → "Unit + e2e test workflow".

**Excluded (with reason):**
- `checkoutHeatmapSimulator.js` — generates synthetic data; no business rule.
- `scannerConfig.js` — a static list, no logic.
- `resolveHeatmapSchema` (`db.js`) — small security allowlist, not business logic.
- **Capture-window date check** — the *other* motivating bug, but it lives **inside** `checkoutHeatmapClient.js` (a browser module) and can't be unit-tested without browser globals. **Deferred to M7.1**: extract to a pure module, then test.
- **Ingest config gates** (step gate, sampling gate, capture-window gate, event-type filter) — pure logic embedded inside the Next.js route handler (`ingest/route.js`), mixed with DB calls and `NextResponse`. **Deferred to M7.2**: extract to a pure helper module, then test.
- Throwaway sandbox UI (AdventureBag, tour mode) and anything the e2e suite already covers behaviorally.

**Not blanket — at the *file* level.** Only the four durable pure-logic modules above are in scope. *Within* those files, every rule is covered (skipping an old M1 rule like drop-off just because it predates M6 would leave an obvious gap).

**Main tradeoff:** blanket retroactive coverage of every milestone = high effort with heavy overlap on the existing e2e suite; targeted coverage of the durable core = most of the value for a fraction of the cost. Both M6 bugs lived in that core, so the payoff is concentrated there.

**Next step:** run `milestone-test-planning` to produce the per-rule test checklist (each rule → its test), then implement part by part per the `AGENTS.md` workflow.

### M7 — AI Report Generation
Using all captured data within the scope and timeframe selected in the admin dashboard, generate an AI-powered report that aggregates visitor behavior, identifies friction points and drop-off patterns, produces a written summary, and outputs actionable recommendations and testable hypotheses for improving checkout conversion.

**How recommendations & hypotheses are produced:** the structured, aggregated findings (drop-off points, field friction, errors, attention) are fed to an LLM, which outputs prioritised recommendations and testable hypotheses ("if we change X, drop-off should fall"). A human reviews the output before acting on it.

#### M7.1 — Capture-window check extraction + unit test (deferred from M6.2)
*Addressed after the main M7 scope is delivered.* The capture-window date-boundary rule (the `to`-as-midnight-UTC bug — one of the two bugs that motivated M6.2) currently lives **inside** `checkoutHeatmapClient.js`, a browser module, so it cannot be unit-tested without browser globals. M6.2 covers the pure-logic core (`checkoutHeatmap.js`, `checkoutHeatmapSampling.js`, `heatmapConfigStore`, `dashboardAuth.js`) and **excludes** this rule. M7.1 extracts the capture-window check into its own pure module and adds the unit test, closing the gap M6.2 left open.

#### M7.2 — Ingest config gate extraction + unit test (deferred from M6.2)
*Addressed after the main M7 scope is delivered.* The four ingest config gates (step gate, sampling gate, capture-window gate, event-type filter) live inside `app/api/checkout-heatmap/ingest/route.js`, mixed with `NextResponse` and DB calls, so they cannot be unit-tested without extraction. M7.2 extracts the gate logic into a pure helper module and adds unit tests, closing the gap M6.2 left open.

### M8 — Integration Readiness
All necessary preparations for embedding the product into a real product (e.g. Autohero). This includes stable API contracts, documented integration seams, clean separation between sandbox-specific and reusable logic, and any authentication or configuration work needed for external deployment.

- **Analyst DB access.** Let Autohero's data analysts read the raw data for their own analysis/hypotheses (in addition to our report). Approach: read-only analytics views (decoupled from raw tables so schema changes don't break them) over a read replica (so heavy ad-hoc queries don't slow capture), plus optional bulk export (CSV/Parquet) and PII/access governance. M3 designs the schema with this in mind; the access layer itself is built here.
- **External traffic limiting contract.** Define how the host (Autohero) limits/signals what share of traffic reaches our tool, and how we record the external sampling rate (see M3 → effective `samplingRate`). Plus the Vercel deploy deferred from M3.

### M1 test cases
11 test cases across 3 spec files. Full specifications in `TEST_CASES.md`.
