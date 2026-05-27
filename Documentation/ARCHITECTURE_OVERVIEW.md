# Architecture Overview

## Purpose

This document is a lightweight technical map of the current Shop sandbox product.

It exists to make the current architecture explicit without turning early-stage product work into a heavy design exercise.

It should be updated whenever the architecture changes in a meaningful way.

## Current system goal

The Shop sandbox is a controlled Next.js prototype used to build and validate a checkout-dropoff analysis product before later integration into external products.

Current implemented focus:
- M1 Personal Information heatmap
- M2 Part 1: auto-discovery scanner for the Personal Information step (replaces the manual registry; `display`/`error` capture; `type:label` anchor IDs)
- M2 Part 2: step-aware sessions — the active step is passed explicitly to the capture client and stored on each session as `step`. Capture was enabled on Personal Information only at this point (delivery/pay added in Part 3).
- M2 Part 3: capture enabled on all three steps (`personal-info`, `delivery`, `pay`). Delivery/Pay options and CTAs are tagged (`radio:delivery-*`, `radio:pay-*`, `cta:pay-finish`, `cta:pay`); sessions on those steps are step-tagged with correct anchors. Note: the prototype has no interactive path to delivery/pay — the step buttons drop the `step` param outside tour mode, and tour mode is a view-only overlay — so those steps are reached via `?step=`.
- M2 Part 4: step-aware heatmap viewer. The single heatmap route is now driven by `?step=` (`resolveCheckoutHeatmapStep`); it filters sessions to the requested step + view, renders that step's `CheckoutFlow` fully-expanded, and titles itself per step. The `TopBar` Heatmap button is now a step dropdown (Personal Information / Choose Delivery / Pay & Finish) that opens the selected step's heatmap in a new tab. The Pay step's conditional card/wire panels are forced open in `heatmapMode` so all pay elements resolve.
- M3 (Parts 1–4): storage moved from the local JSON file to Neon Postgres (`sessions` + `events` tables) behind the unchanged `GET / POST / DELETE /api/checkout-heatmap` contract. `clicks[]` is generalised to `events[]` (a click is `type:"click"` with its payload in a JSONB `detail` column); session-level `outcome` and `samplingRate` fields added (scaffolding mostly written from M4). A read-only query API (`GET /api/checkout-heatmap/query`) and a TTL cleanup endpoint (`POST /api/checkout-heatmap/cleanup`) were added. DB client + schema selection in `lib/prototype/db.js` (`HEATMAP_DB_SCHEMA`, default `public`; tests use `heatmap_test`). Scale/ingestion/sampling design is in `Documentation/SCALE_DESIGN.md` (Part 5, design-only). M3 closed 2026-05-22.
- M4 Part 1: interactive step navigation — the checkout CTA advances step→step in normal mode with a single click. M4 Part 2: batched ingestion pipe (`/api/checkout-heatmap/ingest`, multi-row INSERT) + visitor-level sampling gate (cookie, 100% default); click capture routed through a client ring buffer with interval/size/unload flush; legacy `POST` kept but no longer client-called. M4 Part 3: capture extended beyond clicks to desktop `mouse-move` (throttled ~100 ms) and `scroll` depth, streamed through the same pipe; events are polymorphic (per-`type` normalization) but the default click heatmap is unchanged because aggregation still filters click/tap. M4 Part 4: field focus/blur/change (no raw values), validation-error-shown, and element visibility (IntersectionObserver, ≥50%) captured. M4 Part 5: session lifecycle signals — `localStorage` session resume within window X, lazy/derived finalize via a sweep endpoint (no always-on runtime), zero-interaction bounce committed on the exit beacon, `exit_reason` (`idle`/`nav-click`/`back`/`left-browser`), active/idle step timing, and `advanced`/`completed` outcomes on step navigation; a post-suite `heatmap_test` wipe. M4 Part 6: rendering — mouse-move (density/trails) and scroll (fold/gradient) overlays behind a nested type→style toggle, plus the stored `in-progress` outcome. M4 Part 7: mobile finger-movement capture (`touchmove` → `mouse-move`), rendered in the "See mouse moves" view with a mobile disclaimer. M4 Part 8 port (Chunks A–F): the chosen single style per type — click dots opacity-by-count, scroll green colour-by-depth + legend, mouse-move volume-aware trails with a floating-elements note in an optional top-bar slot; the density/fold-line overlays and the style toggle removed; throwaway sim pages deleted; suite 53/53.

## High-level architecture

The architecture has five main parts. (M1 introduced them on the Personal Information step; M2 extended capture/render to all three checkout steps, M3 moved storage to Postgres, and M4 added the rich event set + batched transport.)

1. UI flow
- The Shop sandbox renders the landing, search, details, checkout, and thank-you flow.
- Capture is attached to all three checkout steps (`personal-info`, `delivery`, `pay`).

2. Client-side interaction capture
- The browser tracks each step's session lifecycle and interactions — clicks/taps, mouse-move (desktop) / finger-move (mobile), scroll depth, field focus/blur/change, validation-error-shown, and element visibility.
- It detects drop-off via the inactivity threshold, records zero-interaction bounces, and resumes a session if the visitor returns within window X.
- Events are buffered in a client ring buffer and flushed (interval / size / `sendBeacon` on unload) to the batched ingest endpoint; a **per-session** sampling gate (probability from the runtime config) can switch capture off for a given session.

3. Server-side storage
- Sessions + events are persisted in Neon Postgres through the API.
- Finalize is lazy/derived (a sweep endpoint marks stale unfinalized sessions `abandoned`), since there is no always-on runtime.

4. Heatmap aggregation and rendering
- The dedicated heatmap route reads persisted sessions, filtered by `?step=` and view.
- Each stored click carries an anchor: the id of the nearest tracked element and an (dx, dy) offset from its center; at render time the anchor resolves to the current DOM element and the dot lands at element center + (dx, dy) — so positions stay stable across layout shifts (validation errors, accordion state, viewport differences).
- Three views over a fully-expanded preview of the selected step: click dots (opacity-by-count), mouse-move trails, and scroll colour-by-depth.

5. Automated verification
- Playwright regression tests verify the key behaviors and are part of milestone completion requirements.

## Current data flow

### Checkout-step tracking flow

1. The visitor opens a checkout step (`personal-info`, `delivery`, or `pay`); the active step is passed explicitly to the capture client.
2. A session starts — or resumes, if the visitor returned within window X; the sampling gate decides whether capture runs at all.
3. Interactions append to a client ring buffer (clicks, mouse/finger movement, scroll depth, field events, validation errors, visibility) and flush in batches to the ingest endpoint.
4. Completing the step marks the session `advanced`/`completed`; inactivity past the threshold — or a zero-interaction exit — is a drop-off.
5. Finalize is lazy/derived: a sweep marks stale unfinalized sessions `abandoned` with an exit reason. Persisted sessions live in Postgres.

### Heatmap rendering flow

1. User clicks `Heatmap` and picks a step from the dropdown.
2. The app opens the dedicated heatmap route in a new browser tab with `?step=<step>`.
3. The route selects the requested step (`personal-info` | `delivery` | `pay`) and view (`desktop_view` | `mobile_view`).
4. The preview renders the requested step directly inside `ShopFrame` with CSS overrides injected for the selected view. On mobile, a `<style>` tag constrains the layout to the most-common recorded viewport width.
5. Persisted sessions are read from the heatmap API and filtered to the requested step + view.
6. The active view is chosen by the type toggle — **clicks** (default), **mouse moves**, or **scrolls** — each filtering `session.events` by type. Clicks is the default so the click-precision tests stay valid.
7. **Clicks:** each click's anchor id resolves to its current DOM element; the dot is placed at element center + (dx, dy). Dot radius scales by click count (max → 24px, proportional, bounded [6px, 24px]) and dot opacity scales with count (Part 8). Fixed-position elements (e.g. the chatbot icon, desktop order-summary sidebar) produce a separate set of dots in a `position: fixed` overlay.
8. **Mouse moves:** one translucent path per session (volume-aware stroke alpha). **Scrolls:** a green colour-by-depth tint (alpha by % of sessions reaching each depth) with an inline "<n>% saw it" legend. Both render in the same shop-content surface as the dots.

## Main runtime boundaries

### Sandbox UI

Primary files:
- `app/checkout/[sku]/page.jsx`
- `components/prototype/CheckoutFlow.jsx`
- `components/prototype/shopRuntime.js`
- `components/prototype/TopBar.jsx`

Responsibility:
- render the current Shop experience
- host the Personal Information step
- expose header actions such as `Heatmap` and `Clear data`

### Heatmap domain logic

Primary files:
- `lib/prototype/checkoutHeatmap.js`
- `lib/prototype/checkoutHeatmapClient.js`
- `lib/prototype/checkoutHeatmapRegistry.js` (M2: auto-maintained scanner snapshot)
- `lib/prototype/scannerConfig.js` (M2: trackable-element definition)
- `lib/prototype/checkoutScanner.js` (M2: live-DOM discovery → anchors)
- `lib/prototype/checkoutHeatmapSampling.js` (M4 Part 2; M6: per-session sampling-rate resolution — the per-visitor cookie was removed, the coin flip lives in the capture client)
- `lib/prototype/checkoutHeatmapResume.js` (M4 Part 5: localStorage session-resume ref — persisted id + last-seen)

Responsibility:
- active session lifecycle
- interaction capture with element-anchor approach (M2: nearest scanner-discovered element + dx/dy offset; anchor id is `type:label`, anchor carries `type`)
- inactivity/drop-off logic
- view classification (desktop vs mobile based on viewport width vs `BREAKPOINTS.DESKTOP`)
- heatmap aggregation and radius scaling
- element registry: tracks every tracked element with `addedAt`/`removedAt` lifecycle

### Persisted heatmap storage

Primary files:
- `app/api/checkout-heatmap/route.js` (`GET / POST / DELETE`; POST legacy/back-compat — client no longer calls it since M4 Part 2)
- `app/api/checkout-heatmap/ingest/route.js` (M4 Part 2: batched ingestion — `{ session, events[] }`)
- `app/api/checkout-heatmap/query/route.js` (M3: read-only query API)
- `app/api/checkout-heatmap/cleanup/route.js` (M3: TTL/archival cleanup)
- `app/api/checkout-heatmap/sweep/route.js` (M4 Part 5: lazy/derived finalize — marks stale unfinalized sessions `abandoned`)
- `lib/prototype/checkoutHeatmapStore.server.js` (M3: Neon Postgres store; M4 Part 2: `ingestCheckoutHeatmapBatch`; M4 Part 5: `sweepCheckoutHeatmapSessions`)
- `lib/prototype/db.js` (M3: Neon client + `HEATMAP_DB_SCHEMA` selection)

Responsibility:
- read finalized sessions
- append finalized sessions
- clear stored history
- query sessions by step / view / timeframe (M3)
- delete sessions past a retention cutoff (M3)

### Heatmap view

Primary file:
- `app/checkout/[sku]/heatmap/page.jsx`

Responsibility:
- open the dedicated heatmap experience
- render selected mobile/desktop preview
- overlay aggregated dots on the exact preview surface

### Automated test layer

Primary files:
- `playwright.config.ts`
- `tests/e2e/m1-heatmap.spec.ts` — Tests 1, 2, 3, 4, 5, 6, 10
- `tests/e2e/m1-heatmap-anchor.spec.ts` — Tests 7, 8, 9 (M2: re-mapped `type:label` anchor IDs)
- `tests/e2e/m1-heatmap-registry-sync.spec.ts` — Test 11 (M2 Part 5: re-pointed at the step-aware `CHECKOUT_ELEMENT_REGISTRY` snapshot, asserted across all three steps)
- `tests/e2e/m2-scanner-pi.spec.ts` — Tests 12 (personal-info), 13, 14, 15, 16 (M2 Part 1: auto-discovery, `data-heatmap-type` hint, `display`, `error`; Part 2: Test 12 personal-info step tagging)
- `tests/e2e/m2-delivery-pay.spec.ts` — Tests 12 (delivery, pay), 18 (capture + render: delivery, pay) (M2 Parts 3–4)
- `tests/e2e/m2-viewer.spec.ts` — Test 19 (M2 Part 4: step-aware viewer — per-step session filtering + view toggle)
- `tests/e2e/m2-fixed-position.spec.ts` — Test 17 (M2 Part 5: fixed-position precision — desktop order-summary sidebar + chatbot icon render in the fixed overlay, ≤10px, stable after scroll)
- `tests/e2e/m3-query-api.spec.ts` — Tests 20–27 (M3: click stored as `type:"click"` event, `outcome`, `samplingRate`, query-API filters step/view/timeframe/combined, TTL cleanup)
- `tests/e2e/m4-step-nav.spec.ts` — Test 28 (M4 Part 1: single-click step navigation; invalid field blocks + shows error)
- `tests/e2e/m4-ingest.spec.ts` — Tests 29–30 (M4 Part 2: batched ingest delivery + beacon-on-close, client no longer calls legacy POST; sampling gate both ways)
- `tests/e2e/m4-mousemove-scroll.spec.ts` — Tests 31–32 (M4 Part 3: desktop mouse-move captured + throttled ~100 ms; M4 Part 7: mobile finger-movement also captured via `touchmove`; scroll events with increasing depth)
- `tests/e2e/m4-field-visibility.spec.ts` — Tests 33–35 (M4 Part 4: field focus/blur/change without raw values; validation-error-shown; element visibility ≥50% with visible duration)
- `tests/e2e/m4-session-signals.spec.ts` — Tests 36–38 + 41 + 42 + 44 (M4 Part 5: zero-interaction bounce + sweep; `advanced`/`completed` outcomes; `step_active_ms`/`step_idle_ms` reconcile; session resume within X; Part 6: `in-progress` outcome + sweep guard; Part 8: session-merge regression guard — Tests 36 + 44 un-skipped in M5)
- `tests/e2e/m4-rendering.spec.ts` — Tests 39, 40, 43 (M4 Parts 6–8: mouse-move trails view; scroll green colour-by-depth gradient + legend; mobile finger-movement render + disclaimer)
- `tests/e2e/m5-login.spec.ts` — Tests 45–48 (M5: login step renders + gate enforced; empty name blocks Continue; valid name advances to PI + writes visitor_id; sessions carry visitor_id; second login mints different visitor_id)
- `tests/e2e/m6-config.spec.ts` — Tests 49–53 (M6 P2+P3: config GET defaults; POST saves with valid token / 401 without; step disabled → 0 sessions; mouse-move disabled → 0 mouse-move events; samplingRate=0 → 0 sessions)
- `tests/e2e/m6-dashboard.spec.ts` — Test 54 (M6 P4: dashboard auth gate wrong/missing token → blocked; valid token renders Data/Heatmap/Report sections; step toggle + Save persists via config API; Clear-data confirmation wipes all sessions)
- Test 3 (`m1-heatmap.spec.ts`) updated in Part 4 to assert the Heatmap step dropdown; Test 1 Scenario A updated in Part 5 (zero-interaction now bounces)
- M3 (Part 2) updated Tests 1, 2, 12, 13, 14, 15, 16, 18 from `session.clicks` to `session.events`. M5 added Tests 45–48 and all flow helpers updated to navigate through the login gate. M6 P2+P3 added Tests 49–53. M6 P4 added Test 54. Full suite: 64 active tests passing.

Responsibility:
- verify milestone behavior
- guard against regressions
- support milestone completion decisions

## Current configurable rules

Important current configurable rules include:
- inactivity threshold
- heatmap radius bounds
- view breakpoint classification

These values must remain explicit because they are likely to evolve across milestones or future integrations.

## Scope history — M1 limits now lifted

These were intentional M1-only limits; later milestones expanded each. Recorded so any lingering M1 framing elsewhere isn't mistaken for current behavior:
- **Tracking scope:** M1 = Personal Information only → **now all three steps** (`personal-info`, `delivery`, `pay`) — M2.
- **Persisted sessions:** M1 = drop-offs only → **now all sessions**, each carrying an `outcome` (advanced/completed/abandoned/in-progress) — M3/M4.
- **Visualization:** M1 = click dots with radius intensity → **now click dots (radius + opacity-by-count) + mouse-move trails + scroll colour-by-depth** — M4.
- **Aggregation:** M1 = Personal Information across all backpacks → **now per-step**, aggregated across backpacks — M2.

## Current durable architecture candidates

The following areas are most likely to survive into later milestones or future integration work:
- explicit session and click data shape
- separation between active capture and finalized persistence
- dedicated heatmap API boundary
- distinct aggregation layer
- automated regression testing as a completion gate

## Current sandbox-specific parts

The following parts are more likely to be replaced or reworked later:
- current AdventureBag prototype UI
- current sandbox route structure
- local file-based persisted store
- current CSS-injection approach for mobile viewport simulation in the heatmap preview

## Maintenance rule

This document must be reviewed and updated whenever architecture changes in a meaningful way, including:
- major data flow changes
- storage model changes
- API boundary changes
- capture/aggregation/rendering boundary changes
- testing architecture changes

## Additional complexity, heatmap needs to account for these to map clicks properly:
  - validation errors change height
  - accordions change height
  - review area has inner scrolling
  - sticky CTA changes visual position
  - heatmap replay is a separate render, not the original DOM state
  - desktop order summary sidebar is `position: fixed` (floats on scroll). Like the chatbot icon, its dots belong in the fixed overlay; the anchor must bind to the *visible fixed* `SummaryCard`, not the `aria-hidden` layout spacer, and the heatmap view must render it fixed — so a click on the sidebar after scrolling lands on the sidebar, not on empty space.
  - ~~no interactive path to the delivery/pay steps~~ **Resolved in M4 Part 1 (2026-05-22).** `getCheckoutHref` now always carries the `step` param (not only under `tour=1`), so the checkout CTA advances step→step in normal mode. The remaining barrier — tour mode's view-only overlay — only applies in tour mode, which is not the normal visitor path. Capture remains step-correct (`resolveStep` reads `?step=`).

## New arch solution for heatmap

### Approach

Instead of recording clicks as absolute coordinates relative to the page surface, each click is anchored to the nearest named UI element. At capture time the system identifies the closest interactive element to the click point and stores the click as an offset (dx, dy) from that element's center, together with a stable element identifier.

At heatmap render time the system locates the same element in the live DOM and places the dot at `element.center + (dx, dy)`. Because the dot position is derived from the element's current position in the heatmap layout — not from stored absolute coordinates — layout shifts caused by validation errors, open accordions, viewport width differences, or any other re-flow are automatically irrelevant.

Clicks in free space (not directly on any element) are handled the same way: the nearest element becomes the anchor and the offset captures the distance to it. This means all clicks, whether on elements or between them, are positioned correctly relative to the heatmap layout.

### Element registry

Each tracked element has a type (e.g. button, textbox, dropdown, checkbox, radio button, accordion control) and a visible label (the text the visitor sees). Together they form the element identifier used for both click anchoring and engagement reporting.

The registry must be extensible. When integrating with a new product, new element types and names can be added to the registry without changing the core capture or rendering logic. This is required because future product pages will contain elements not present in the current Personal Information step.

The element identifier is also the primary key for the future engagement report, which will show which elements visitors interact with most.

### Tech debt created by this transition

1. ~~**Two parallel capture paths**~~ — **Resolved in M1.** The `anchorMode` flag and the old coordinate-based capture path have been removed. Anchor capture is now unconditional.
2. ~~**Two parallel rendering paths**~~ — **Resolved in M1.** The renderer has no coordinate-based fallback; clicks without a valid `anchor.id` are silently skipped.
3. ~~**Old session data becomes unusable**~~ — **Resolved in M1.** The renderer now skips clicks without a valid `anchor.id` rather than attempting to render them with old coordinate data.
4. **Registry maintenance** — every form change (add, remove, or rename an element) requires a registry update, otherwise old clicks lose their anchor silently.
5. ~~**`data-heatmap-id` attributes as silent coupling**~~ — **Resolved in M1.** Test 11 enforces the invariant automatically, catching any drift between rendered `data-heatmap-id` attributes and active registry entries.
6. ~~**Precision tests need rewriting**~~ — **Resolved in M1.** The old coordinate-based precision test was deleted and replaced with element-anchor tests (Tests 7, 8, 9).

Migration cleanup complete: feature flag removed, old capture and rendering code removed. Old session data (if any) produces no dots — skipped silently by the renderer.

### Resolved behavior per case

1. **Click directly on an element** — anchor = that element, dot snaps to its center. Identifier = element type + visible label.
2. **Click near an element (free space)** — anchor = nearest element by edge distance, dot appears at exact click position as offset from anchor. No distance threshold — always anchors to nearest element.
3. **Click far from any element** — not applicable, resolved by Case 2 (no threshold).
4. **Anchor element not found in heatmap** — resolved by always rendering the heatmap fully expanded: `showPersonalInfoValidation` makes validation errors visible, `heatmapMode` forces all accordions open (`forceAllOpen`), initializes the birthdate tooltip visible (`showBirthdateHelp: true`), and expands the order summary (mobile). All registered anchor elements are always present in the DOM.
5. **Multiple sessions with different anchor elements present** — resolved by Case 4 (fully expanded heatmap).
6. **Click outside the surface entirely** — not applicable. Named elements cover the full page including header, breadcrumb, and chatbot icon, so every click has a nearest anchor.
7. **New element added to the form** — old clicks still work anchored to nearby elements. New clicks use the new element automatically. No manual heatmap update needed.
8. **Existing element removed or renamed** — removed elements remain visible in the heatmap as disabled/greyed out with a label showing the date and time they were removed. The registry tracks when each element was added and removed. When the user filters the heatmap by timeframe: if the selected timeframe includes the period when the element existed, show it; if the element did not exist in that timeframe, hide it. This behavior requires the future timeframe dashboard feature.
9. **Same element appears multiple times** — identifier includes a positional index as tiebreaker (e.g. `button:Edit:2` = second Edit button). Not currently applicable to the Personal Information step.

## M2 architecture — auto-discovery scanner

**Status: Parts 1–5 implemented (M2 complete pending `milestone-prereqs`).** Parts 1–4: scanner config + scanner module, capture and render wired through it, registry regenerated as an auto-maintained snapshot, `display`/`error` capture; Part 2 added step-aware sessions — the active step is passed explicitly to the capture client on init and stored as `session.step`, resolved/validated via `resolveCheckoutHeatmapStep`; Part 3 enabled capture on all three steps and tagged the Delivery/Pay options and CTAs, so delivery/pay clicks produce step-tagged sessions with correct anchors; Part 4 made the viewer step-aware — `?step=`-driven session/view filtering, per-step fully-expanded render, and the `TopBar` step dropdown. Part 5 verified fixed-position precision (Test 17 — sidebar + chatbot, ≤10px, no anchoring hardening needed) and re-pointed the registry-sync invariant (Test 11) at the step-aware snapshot across all three steps. Suite: 24/24 green.

M2 replaces the M1 hand-maintained registry (`PERSONAL_INFO_ELEMENT_REGISTRY`) with a config-driven scanner; the snapshot it maintains is now `CHECKOUT_ELEMENT_REGISTRY` (step-aware, spans all steps). Approach:

- **Live discovery is the source of truth.** At capture-time the scanner walks the rendered DOM of the active step, matches elements against `scannerConfig` (`autoDiscovered` selectors + the `manualOnly` `data-heatmap-id` escape hatch), and produces anchors on the fly. This gives per-step extensibility with no code change per step.
- **Semantic types via hints.** Types that cannot be inferred from markup (`cta`, `toggle`, `tooltip`, and date/tel/radio/checkbox controls built from plain `<button>`/`<input>`) are declared with an explicit `data-heatmap-type` attribute; the scanner trusts the hint over the structural guess.
- **Auto-maintained registry snapshot.** The registry is no longer edited by hand — the scan maintains it (append new, mark `removedAt`). Each entry carries a `steps` list (which steps it renders on). This preserves the `addedAt`/`removedAt` lifecycle needed for timeframe filtering, removed-element display (M6), and the engagement report (M8). Test 11's registry↔DOM invariant is re-pointed at this auto-maintained snapshot and asserted per step across all three steps. Only tagged anchors are recorded; untagged auto-discovered elements are resolved live.
- **Active step passed explicitly** to the client on init — not auto-detected from the DOM. Sessions carry a `step` field; capture/drop-off/aggregation run per step.
- **New non-interactive types:** `display` (read-only value fields) and `error` (validation messages, detected via `data-field-error`).
- **Fixed desktop order-summary sidebar** is treated like other `position: fixed` elements (see Additional complexity above): anchored to the visible fixed `SummaryCard`, rendered fixed in the heatmap.

New modules (Part 1, done): `lib/prototype/scannerConfig.js`, `lib/prototype/checkoutScanner.js`; capture (`checkoutHeatmapClient.js`) and render (`heatmap/page.jsx`) resolve anchors through the scanner — tagged elements via `data-heatmap-id`, untagged auto-discovered elements (e.g. error messages, tooltip close) via a re-scan at render time. The store, API, heatmap view, and `TopBar` (step dropdown) were extended for step-awareness across Parts 2–4 (done). Part 5 (hardening + close) is done: Test 17 fixed-position precision and the all-steps Test 11 re-point. Full sequencing is in `PRODUCT_OVERVIEW.md` → M2 → Implementation plan (phased).

## M3 architecture — Postgres store, full schema, query API

**Status: COMPLETE (2026-05-22).** All five parts delivered; 32/32 tests green on the Postgres store; close gates met. Scope frozen 2026-05-21 (`PRODUCT_OVERVIEW.md` → Future Milestones → M3). The JSON file store has been replaced with Neon Postgres (`sessions` + `events` tables) behind the unchanged `GET / POST / DELETE /api/checkout-heatmap` contract; the existing click capture writes to Postgres (click → event `type:"click"`); `outcome` + `samplingRate` fields and read-only query (`/api/checkout-heatmap/query`) + TTL cleanup (`/api/checkout-heatmap/cleanup`) endpoints are in place. 32/32 tests green on Postgres. The batching/ingestion/sampling **scale design is documented in `Documentation/SCALE_DESIGN.md`** (design-only; the pipe + sampling gate are built in M4). This section remains the architecture + implementation plan from the `milestone-start` gate.

### Goal and boundaries

M3 replaces the local JSON file store with Postgres (Neon, free tier), defines the full event-capable schema, points the *existing click capture* at Postgres, and adds a read-only query API. M3 keeps it simple: the only write path is the existing click capture. The batched ingestion pipe, the sampling/config gate, and capture of the rich new events (mouse-move, scroll, field focus/blur/change, visibility) are **deferred to M4** — M3 only makes the schema able to hold them and *documents* the batching/sampling design.

### Storage model change

- **From:** local JSON file at `.m1-data/checkout-heatmap-sessions.json`, accessed through `lib/prototype/checkoutHeatmapStore.server.js` (atomic `.tmp` rename writes).
- **To:** Postgres (Neon) via a pooled connection string, accessed through the same store module — the store implementation swaps, the `GET / POST / DELETE /api/checkout-heatmap` API contract stays unchanged so the existing heatmap viewer keeps working.
- Dev runs locally against Neon via the pooled connection string. Vercel deploy is deferred to M8.
- Connection string carries credentials → `.env` + `.gitignore` handling before any DB code lands (tracked as a critical anticipated item).

### Schema

- **`clicks[]` → `events[]`.** Each event has a `type` (`click` exists now; `scroll`, `field-focus`, etc. arrive in M4) plus a JSON detail column for type-specific, extensible payload. Raw + extensible so M4 events and changing report needs slot in without migration. POC data is throwaway — schema can change freely; clear and regenerate rather than migrate.
- **Session-level fields added:** `outcome` (completed/advanced vs abandoned — records all sessions, not just drop-offs, so completers-vs-non-completers comparison is possible), `samplingRate` (effective = external % × internal %; field only in M3, mechanism in M4), step timing (active/idle split), element visibility duration. Most are written only from M4 — in M3 they exist as schema scaffolding.
- **Indexing for scale:** indexes on `step` / `view` / `timestamp` and connection pooling are designed and set up in M3 against the Autohero volume expectation (thousands/day), though exercised only at POC volume (~1k/day). Pre-aggregation (rollups/materialised views) is deferred until a query proves slow.
- Canonical field definitions live in `DATA.md`; the M3 schema row there is updated as part of this milestone.

### Query API

- New read-only `GET` endpoints returning JSON, filterable by `step`, `view`, `timeframe`, and other dimensions. No browsing UI (deferred to M6 dashboard), no access control (deferred to M6), no pagination/limits in M3 (tracked as non-critical debt).
- Manual testing = call endpoint URLs and inspect the JSON.

### Files expected to change / be added

- **New:** Postgres client + pooled connection helper; migration/DDL for the schema; the new query-API route(s); a DB-inspection endpoint (or script) for Part 1's manual check; TTL/archival cleanup job.
- **Changed:** `lib/prototype/checkoutHeatmapStore.server.js` (JSON → Postgres behind the same interface); `app/api/checkout-heatmap/route.js` (unchanged contract, new store); capture/aggregation modules where they reference `clicks[]` → `events[]`; `DATA.md` schema row; test setup for test-DB isolation + teardown.
- **Unchanged contract:** `GET / POST / DELETE /api/checkout-heatmap` so the heatmap viewer keeps reading without change.

### Implementation plan (phased — each part ends with a manual check)

M3 is delivered in five sequential parts; the next part does not begin until the current one's manual check is confirmed (same discipline as M2). Stored data is throwaway — clear and regenerate rather than migrate.

**Part 1 — Neon + schema + connectivity.** Stand up Neon, create the full `events[]` / `outcome` / `samplingRate` / step-timing / visibility schema with indexes, wire the pooled connection, set up test-DB isolation + `.env`/`.gitignore`. *Manual check:* open a DB-inspection URL (or run one query) → tables exist with the right columns, 0 sessions.

**Part 2 — Capture writes to Postgres.** Point the existing click capture at the new schema (click → event `type:"click"`); keep the `GET/POST/DELETE` contract so the viewer still reads it. *Manual check:* do a real drop-off in the shop → open the heatmap → dot renders (served from Postgres); click **Clear data** → heatmap empties, DB rows gone.

**Part 3 — Read-only query API.** New `GET` endpoints filterable by step / view / timeframe → JSON. *Manual check:* hit the URLs in a browser with different filters → JSON matches the drop-offs just made.

**Part 4 — TTL / archival.** Storage cleanup to stay under the 0.5 GB Neon free limit. *Manual check:* seed old sessions (or short TTL) → run cleanup → query API shows old rows gone, recent kept.

**Part 5 — Scale design doc + close.** Document the batching / ingestion / sampling approach in `Documentation/SCALE_DESIGN.md` (design-only; pipe built in M4); run close gates; full suite green on Postgres. *Check:* review the design doc (not a runtime test) + confirm the suite green against the Postgres store (32/32).

### Tech debt context

Anticipated M3 debt is recorded in `PRODUCT_OVERVIEW.md` → Tech Debt: two critical items to resolve before close (test-suite DB isolation; DB-credential handling) and seven non-critical items (schema-vs-capture gap, `clicks[]`→`events[]` migration surface, unbatched write-per-event, scale validated only at POC volume, no auth/pagination on the query API, network-dependent local dev, TTL/archival as new infra).

## M4 architecture — extended interaction capture + batched pipe

**Status: CLOSED (2026-05-26). Parts 1–8 delivered; close gates met (`milestone-doc-review`, agent review, `milestone-prereqs` READY). Tests 36 + 44 were `test.fixme` at M4 close and were un-skipped and fixed in M5.** Scope decisions agreed during planning (see `PRODUCT_OVERVIEW.md` → Future Milestones → M4 → "Decisions agreed"). This section is the architecture + implementation plan required by the `milestone-start` gate, structured so each part ends with a manual check. The batching / ingestion / sampling design it builds on is in `Documentation/SCALE_DESIGN.md`. Part 1 (interactive step navigation, Test 28), Part 2 (batched ingestion pipe + sampling gate, Tests 29–30), Part 3 (mouse-move + scroll-depth capture, Tests 31–32), Part 4 (field/validation/visibility capture, Tests 33–35), Part 5 (session signals + outcomes, Tests 36–38 + 41), Part 6 (rendering — two views each behind a toggle, Tests 39–40 + 42), and Part 7 (mobile finger-movement capture, Test 43) are implemented and verified; the Part 8 port (chosen single style per type) is implemented and the suite is 53/53 green.

### Current shape (M4 at close)

End to end, the current system is: **capture** — a React hook attaches listeners on the checkout step for clicks, mouse/finger movement, scroll, field, validation, and visibility events → **batched transport** — a client ring buffer flushes to `POST /api/checkout-heatmap/ingest` on interval/size and on unload via `sendBeacon`, and a cookie sampling gate can switch it off → **Neon Postgres** (`sessions` + `events`, idempotent upserts) → **lazy/derived finalize** — a sweep marks stale sessions `abandoned`; there is no always-on runtime → **viewer** — the heatmap route filters by `?step=` / `view` and renders one of three views (click dots opacity-by-count, mouse-move trails, scroll colour-by-depth). The part-by-part record below is the **build history**; this paragraph is the **end state**.

### Goal and boundaries

M4 expands capture from clicks to the full M3 event model, builds the batched ingestion pipe and the sampling gate that `SCALE_DESIGN.md` designed, fixes interactive step navigation, and adds two candidate visualisations each for mouse-move and scroll. The M3 schema already holds these events (the `events` table + JSONB `detail`), so M4 is mostly capture + transport + render — not schema migration.

- **In scope (events):** mouse movement (desktop, throttled ~100 ms), scroll depth, field focus/blur/change, validation-error-shown, element visibility (IntersectionObserver), zero-interaction sessions, exit reason (`idle` / `nav-click` / `back` / `left-browser`), time-per-step (active/idle split).
- **In scope (infra):** client batching (ring buffer + flush), batch ingest endpoint, visitor-level sampling cookie (default 100%), event-level throttle for mouse-move, effective `samplingRate` per session.
- **In scope (flow):** fix the checkout CTA so a single click advances each step in normal (non-tour) mode — enables real `advanced`/`completed` outcomes.
- **In scope (render):** two candidate views each behind a viewer toggle — mouse-move (density heatmap + path trails), scroll (fold line + colour-gradient-by-depth); pick the winner before close.
- **Deferred:** hover/dwell, resize/orientation, text selection; ~~mobile touch-move~~ (pulled into Part 7 scope 2026-05-24 — see M4 Part 7); thank-you-page instrumentation and `completed`-on-purchase (kept cheap to add); per-event-type config UI (M6); field-level/visibility dedicated visualisations (M6/M7).

### Architecture changes

- **Capture client (`checkoutHeatmapClient.js`):** add listeners for the new event types; an in-memory **ring buffer**; a throttle for mouse-move; an IntersectionObserver for visibility; per-step active/idle timers; exit-reason detection via `visibilitychange`/`pagehide`. Events are appended to the buffer, never sent one-by-one.
- **Session resume + deferred finalize:** the session ID is persisted across a leave/return gap (cookie/`sessionStorage` + a "left-at" timestamp). On load, if the visitor returns within the configurable window **X** (default 30s; 2s for autotests) the prior session **resumes** (same ID, events keep appending); otherwise a new session starts. Exit (beacon) flushes buffered events but does **not** finalize the session. Finalization is deferred until X elapses with no return. **The signal we need is step completion, not return:** completing the step (`advanced`/`completed`) is the success event, recorded the moment it happens (Part 1) — after a leave, time-to-complete = completion timestamp − tab-close timestamp; no completion within X = dropped off. A return is observable as events arriving after the tab-close beacon on the same persisted session ID (within X they append to the same session; after X they start a new session and the prior one stays dropped off — acceptable for the POC). Because there is **no always-on runtime** (local dev; Vercel deferred to M8) and a closed tab cannot run its own timer, finalize is **lazy/derived, not real-time**: the dropped-off state is computed from timestamps (last activity + X, no return, no advance) when the data is next read/queried or when the next request triggers an opportunistic sweep, with a dedicated sweep endpoint to force it for tests/manual checks. A zero-interaction visit is committed on exit and resolved the same way after the X grace window. POC = single short X; external re-entry (email/dashboard) and the longer two-window "abandoned-but-reopenable" model are M8 (kept cheap to add — see `FUTURE_THIRD_PARTY_INTEGRATION.md`).
- **Exit reason (`exit_reason` on the session):** four buckets — `idle` (the inactivity window elapsed with no in-page exit click; also absorbs invisible cases — walked away, phone asleep, OS-killed tab can't be told apart), `nav-click` (the last event before the page hid was a click on an in-page element that navigates away — external link, backpack image, breadcrumb — recorded with *which* element), `back` (a `popstate` was observed — best-effort), and `left-browser` (a `pagehide`/`visibilitychange→hidden` with none of the above: tab/window close, typed URL, bookmark — mutually indistinguishable, so combined). A **reload is not an exit** — the session resumes and the idle clock continues from the last real interaction. The chatbot-icon click is captured but never classifies as an exit (it opens an in-page panel later, no navigation); the sandbox-only Heatmap / Clear-data controls are excluded (absent for real visitors). **Design intent — maximise separation:** every exit-capable on-page element is individually identifiable; ones already covered by the click anchors are read from the last recorded click, and any that are not get an explicit `data-` exit tag, so no in-page exit collapses into `left-browser`. Only the genuinely indistinguishable browser-level exits (tab/window close, typed URL, bookmark, OS kill) are combined. Connectivity-loss and app-crash detection are **out of scope here** — see `PRODUCT_OVERVIEW.md` → Tech Debt → Non-critical (logging/observability); such exits fall back to `idle` or `left-browser`.
- **Transport:** flush the buffer on size threshold, time interval (`fetch` with `keepalive`), and unload (`navigator.sendBeacon`). Replaces the finalize-only single POST. Idempotent: each event keeps its client `id`; the server upserts `ON CONFLICT (id) DO NOTHING` (already true).
- **Ingest endpoint (`app/api/checkout-heatmap/ingest/route.js`, new):** accepts a batch `{ session, events[] }`, writes the session (upsert) + a **multi-row INSERT** of events in one round-trip. The existing `POST /api/checkout-heatmap` contract stays for back-compat.
- **Sampling gate:** a per-visit decision persisted in a cookie (default 100%); if not sampled, capture is fully off. Effective `samplingRate` (external × internal) stored on the session.
- **Step navigation fix (`CheckoutFlow.jsx` / `shopRuntime.js` / `buildShopQuery`):** make the CTA advance the step in non-tour mode; ensure a single click advances when mandatory fields are valid (fix the observed double-click).
- **Renderer (`app/checkout/[sku]/heatmap/page.jsx`):** add mouse-move and scroll visualisations, each with two modes behind a toggle; drive off the queried `events[]` filtered by `type`.

### Files expected to change / be added

- **New:** `app/api/checkout-heatmap/ingest/route.js` (batch ingest); a sampling helper (cookie decision); a session-resume helper (persisted session ID + "left-at" timestamp); visualisation modules for mouse-move + scroll.
- **Changed:** `lib/prototype/checkoutHeatmapClient.js` (new listeners, buffer, throttle, flush, exit reason, session resume); `lib/prototype/checkoutHeatmap.js` (event types, outcome/step-timing model); `lib/prototype/checkoutHeatmapStore.server.js` (batch write path; outcome/timing columns now written; server-side deferred-finalize sweep after the X window); `components/prototype/CheckoutFlow.jsx` + `shopRuntime.js` (step navigation); `app/checkout/[sku]/heatmap/page.jsx` (new views + toggle); `DATA.md` (new event types + outcome/timing now written); test specs.
- **Unchanged contract:** `GET / POST / DELETE /api/checkout-heatmap` and `GET /api/checkout-heatmap/query`.

### Implementation plan (phased — each part ends with a manual check)

M4 is delivered in sequential parts; the next part does not begin until the current one's manual check is confirmed (same discipline as M2/M3). Captured POC data is throwaway — clear and regenerate rather than migrate.

**Part 1 — Interactive step navigation fix. DONE (2026-05-22).** Make the checkout CTA advance step→step in normal mode; one click advances when mandatory fields are valid (fix the double-click). *Manual check:* from the shop, click through personal-info → delivery → pay with a **single** click each (fields filled) → each click advances exactly one step; no second click needed.

*Two root causes fixed:* (1) `getCheckoutHref` (`shopRuntime.js`) only emitted the `step` query param under `tour=1`, so a normal-mode CTA click navigated without `?step=` and never advanced — it now always carries `step` (tour params preserved under `isTour`). (2) The double-click: `LeftCard`/`ActionBar` were defined **inside** `CheckoutFlow`, so each render produced a new component type and React remounted the CTA button; the first click blurred the focused input → `setActiveField(null)` → re-render → the button remounted mid-click and the click was swallowed. Both were hoisted to module scope so the button's ancestors are stable and the first click lands. (The `StickyInput` mobile focus-restoration via `activeField` is unchanged.)

*Testable deliverables (Part 1):*
- Single click advances Personal Info → Delivery when all mandatory fields are valid — no double-click.
- Single click advances Delivery → Pay the same way, one click per step.
- Pay CTA → existing thank-you page; the session is recorded as `completed` (success, not drop-off).
- An invalid mandatory field blocks advance — stays on the step and shows the validation error.
- Automated Test 28 (single-click step navigation) passes; the full suite stays green.

**Part 2 — Batched ingestion pipe + sampling gate. DONE (2026-05-23).** Add the client ring buffer + flush (size/time/unload) and the `ingest` endpoint with multi-row INSERT; add the visitor-level sampling cookie (100% default). Route the existing **click** capture through the new pipe. *Manual check:* do a drop-off → in the browser network tab see batched `ingest` calls (incl. one on tab close via beacon) → clicks still appear in the heatmap and DB → a sampling cookie is set.

*Implemented:* new `app/api/checkout-heatmap/ingest/route.js` (batch `{ session, events[] }`); `ingestCheckoutHeatmapBatch` in `checkoutHeatmapStore.server.js` (session upsert with COALESCE-protected `finalized_at`/`outcome` + GREATEST counts, then a single multi-row event INSERT `ON CONFLICT (id) DO NOTHING`); new `lib/prototype/checkoutHeatmapSampling.js` (per-visit cookie decision `m1.heatmap.sampled`, rate via `heatmapSampleRate` query param → `NEXT_PUBLIC_HEATMAP_SAMPLING_RATE` env → default 1; deterministic at 0%/100%). `checkoutHeatmapClient.js` now gates capture on the sampling decision, buffers events in a ring buffer, flushes on interval (5s) / size (50) via `fetch` keepalive and on `pagehide`/`visibilitychange→hidden` via `sendBeacon`, and routes the inactivity finalize through `/ingest`. Tests 29 (batched delivery + beacon survives close; client no longer calls the legacy POST) and 30 (sampling gate both ways) added in `tests/e2e/m4-ingest.spec.ts`. Suite 38/38 green.

*Transitional decisions (2026-05-22):* Part 2 changes transport only — **finalize stays client-side on inactivity** (the existing M3 drop-off → `outcome:"abandoned"` flow), so Tests 1/2/12/18 keep passing unchanged. Server-side deferred finalize, session resume, and the X grace window are built in **Part 5** as planned. The legacy `POST /api/checkout-heatmap` write path is **kept for back-compat but the client stops calling it** — capture writes only via `/ingest`; `GET`/`DELETE` are unchanged.

**Part 3 — Mouse-move + scroll capture. DONE (2026-05-23).** Add desktop mouse-move (throttled ~100 ms) and scroll-depth capture into the buffer. *Manual check:* do a session moving the mouse and scrolling → `GET /api/checkout-heatmap` (or query API) shows `mouse-move` events spaced ~100 ms apart and `scroll` events with depth.

*Implemented:* the event model is now polymorphic — `normalizeCheckoutHeatmapSession` dispatches per `type` via `normalizeCheckoutHeatmapEvent` (clicks/taps keep the rich M1/M2 shape; `mouse-move` carries surface-relative `x`/`y`; `scroll` carries `depth` 0–100 + `scrollY`; unknown/legacy untyped → click). New domain helpers `createCheckoutHeatmapMouseMove`, `createCheckoutHeatmapScroll`, `appendCheckoutHeatmapEvent`. The store needed no change — it already flattens `{id,type,timestamp,...detail}` into the JSONB `detail` column and rebuilds events on read. `checkoutHeatmapClient.js` adds a desktop-only (`view === desktop_view`) `mousemove` listener throttled to ~100 ms and a `scroll` listener that always counts as activity but only records a depth-bearing `scroll` event on a throttled tick when the depth changed; both append through the same ring buffer + flush as clicks. Click aggregation (`aggregateCheckoutHeatmapClicks`, `buildAnchorAwarePoints`) still filters to click/tap, so the default heatmap is unchanged. Tests 31–32 in `tests/e2e/m4-mousemove-scroll.spec.ts`. Suite 41/41 green.

**Part 4 — Field + validation + visibility capture. DONE (2026-05-23).** Add field focus/blur/change, validation-error-shown, and element-visible/-hidden (IntersectionObserver). *Manual check:* focus and edit fields, trigger a validation error, scroll an element into view → those events appear in the stored session with sensible `detail`.

*Implemented:* new event types + creators (`createCheckoutHeatmapFieldEvent` / `createCheckoutHeatmapValidationError` / `createCheckoutHeatmapVisibility`) and `normalizeCheckoutHeatmapEvent` dispatch in `checkoutHeatmap.js`. `checkoutHeatmapClient.js` adds: `focusin`/`focusout` handlers that emit field-focus/blur and field-change-on-blur, **keyed by anchor id not DOM node** (controlled inputs remount on change — the StickyInput debt — so node identity is unstable); a `MutationObserver` on `data-field-error` that emits one `validation-error` per error as it appears; an `IntersectionObserver` (threshold ≥50%) over every scanned anchor that emits element-visible/-hidden and carries the visible duration on hidden. These events are appended via a new `recordSessionEvent` path that does **not** push to the live `pending` stream buffer — they persist when the session is saved (drop-off finalize), so Part 4 changes only *what* is captured and leaves session lifecycle/persistence unchanged (a no-interaction load still produces 0 sessions; the IntersectionObserver's initial report is seeded without emitting). Tests 33–35 (`tests/e2e/m4-field-visibility.spec.ts`). Tests 20 and 29 were updated to filter events by `type` (the clicked field now also emits field events on the same anchor). Suite 44/44 green. **Transitional limitation (resolved in Part 5):** because these events are not in the live buffer, an abrupt tab close before finalize beacons only the buffered clicks, not the field/visibility events — robust exit + server-side finalize is Part 5.

*Capture decisions (2026-05-23):*
- **No raw field values.** `field-focus` / `field-blur` / `field-change` carry the field anchor id + a filled/empty indicator (value-present flag and/or length) — never the typed text. Autohero captures input values at its own layer; we capture only the behavioural signal (field completed → could proceed, vs empty → mandatory-field validation triggered). Avoids PII.
- **`field-change` on blur/commit**, not per keystroke — recorded at blur when the value changed (~one per edited field). `field-focus` on entering, `field-blur` on leaving.
- **Visibility = per-element exposure time, all tracked elements.** An IntersectionObserver over every scanned anchor emits `element-visible` (entered viewport) + `element-hidden` (left viewport) with timestamps; per-element visible duration is derived by pairing them across the session. This distinguishes "stayed on the initial render view" from "scrolled down, dwelled mid-page, then reached the footer." All visible/hidden events are stored raw (queryable by an Autohero data engineer for most-seen areas). The attention/exposure heatmap that visualises duration is deferred to M6/M7 — M4 captures + stores only.

**Part 5 — Session signals + outcomes. DONE (2026-05-24).** Add session resume (session ID persisted in `localStorage` + a "left-at" timestamp; resume on return within X — default 30s, 2s for autotests — else a new session) with **lazy/derived finalize**: the dropped-off state is computed from timestamps when data is next read/queried or when the next request triggers an opportunistic sweep — no always-on timer/cron — and a dedicated **sweep endpoint** lets tests/manual checks force it. Plus zero-interaction bounce sessions; **exit reason** (`idle` / `nav-click` *with which element* / `back` / `left-browser` — separate every trigger we can, tag any exit-capable element not already tracked, combine only the truly indistinguishable browser-level exits); active/idle step timing (idle = the same inactivity threshold); and `outcome` (`advanced` on step advance, `completed` at the final step). **Test infrastructure (added to P5 scope 2026-05-24):** wipe the `heatmap_test` schema once after the full suite finishes so no test data persists between runs (it shares the Neon free-tier budget); per-test data is already cleared before each test. *Manual check:* click through steps → sessions tagged `advanced`/`completed`; open and immediately leave a step → a zero-interaction session with the right exit reason; leave a step and return within X → the **same** session resumes (no new session); verify active/idle split looks right.

*Implemented:*
- **Domain (`checkoutHeatmap.js`):** `CHECKOUT_HEATMAP_OUTCOMES` (`advanced`/`completed`/`abandoned`) + `CHECKOUT_HEATMAP_EXIT_REASONS` (`idle`/`nav-click`/`back`/`left-browser`); `finalizeCheckoutHeatmapSession` now takes `{ outcome, exitReason }`, defaults a dropped-off session's reason to `idle`, and forces success outcomes to carry **no** exit reason; new `computeCheckoutHeatmapStepTiming` splits a visit into `stepActiveMs` / `stepIdleMs` (each inter-event gap counts active up to the inactivity threshold, the rest is idle) so **active + idle = duration**. `exitReason`/`stepActiveMs`/`stepIdleMs` round-trip through `normalizeCheckoutHeatmapSession`.
- **Resume (`checkoutHeatmapResume.js`, new):** `localStorage`-backed `{ id, step, sku, lastSeen }`; `loadResumableSessionId` resumes when the visitor returns to the same step+sku within X of the last activity. "Last seen" is refreshed on mount + each interaction (NOT on unload) so a visitor idle past X correctly starts a new session on return.
- **Client (`checkoutHeatmapClient.js`):** on mount, adopt a resumable id (the server upsert keeps the original `started_at`); the unload beacon now commits the **full** session (all events, even zero — a zero-interaction bounce) without finalizing, carrying a best-guess exit reason (`popstate`→`back`, `<a href>` click just before exit→`nav-click`, otherwise→`left-browser`); the inactivity timer's drop-off defaults to `idle`. `completeSession(outcome)` (exposed as `window.__m1CheckoutHeatmapComplete` + the exported `flushCheckoutHeatmapOutcome`) does the explicit success finalize. The resume ref is cleared on any finalize.
- **Outcome wiring (`app/checkout/[sku]/page.jsx`):** `setStep` flushes `advanced` when moving to a later step; `onFinish` flushes `completed`.
- **Store (`checkoutHeatmapStore.server.js`):** `sessions` upserts now write `exit_reason` / `step_active_ms` / `step_idle_ms` (COALESCE-protected in the ingest path); new `sweepCheckoutHeatmapSessions({ now, force })` finalizes stale unfinalized + outcome-less sessions in JS (reusing `finalizeCheckoutHeatmapSession`), deriving the drop-off time from last interaction + X. `force` skips the age check (tests).
- **Endpoint (`app/api/checkout-heatmap/sweep/route.js`, new):** `POST` → `{ ok, finalized }`; accepts `{ now, force }`.
- **Schema (`scripts/db-setup.mjs`):** added `exit_reason TEXT` (+ idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`); `step_active_ms`/`step_idle_ms` already existed from M3.
- **Field/visibility on the beacon path:** the unload beacon sends the whole `session.events`, so field/visibility events (appended but not on the interval `pending` buffer) survive an abrupt close — resolving the Part 4 transitional limitation.
- **Test wipe:** `tests/global-teardown.ts` (wired via `playwright.config.ts` `globalTeardown`) truncates the `heatmap_test` schema once after the suite — guarded to never touch `public`.
- **Tests:** `tests/e2e/m4-session-signals.spec.ts` (36 bounce, 37 advanced/completed, 38 timing, 41 resume). Test 1 Scenario A updated (zero-interaction now bounces); m4-ingest Test 30 + m2-viewer/m3-query-api seeding adjusted so funnel pass-through pages don't create spurious bounces.

**Part 6 — Rendering (two views each, behind a toggle). DONE (2026-05-24).** Implemented as planned: the heatmap page (`app/checkout/[sku]/heatmap/page.jsx`) drives `type`/`style` from URL params; `ShopFrame` gained an `overlay` slot so the mouse-move (density/trails) and scroll (fold/gradient) overlays render inside the same relative shop-content surface as the click dots; the click view stays the no-param default. The stored `in-progress` outcome is server-stamped in `ingestCheckoutHeatmapBatch` with the upsert CASE guard, and the sweep matches `outcome IS NULL OR 'in-progress'`. Tests 39, 40, 42 green (52/52 suite). The two scope-coupled agents were refreshed first (below).

*Prerequisite (decided 2026-05-24): refresh two stale agent definitions before any Part 6 code.* `heatmap-qa` and `test-impact` have drifted behind M4 and both touch the rendering work, so they are fixed first (not deferred to the Part 7 agent review). `heatmap-qa.md` — correct its M1/M2-era expectations ("scroll excluded" → scroll is captured; "stored via `POST /api/checkout-heatmap`" → batched `/ingest`; "finalize after ≥1 interaction" → zero-interaction bounces + lazy/derived sweep finalize) and add the M4 event types, session signals, and new files. `test-impact.md` — extend its file→test map past Test 27 to cover Tests 28–42 and the M4 spec/source files. Prefer discovery-based wording. (The remaining agent review still runs as a Part 7 close gate.)

Add mouse-move (density heatmap + path trails) and scroll (fold line + gradient) views to the heatmap page, switchable via a toggle, driven by the queried events. *Manual check:* open the heatmap for a step with movement/scroll data → toggle between both mouse-move modes and both scroll modes → each renders correctly on the step surface (desktop + mobile where applicable).

*Toggle UI (agreed 2026-05-24):* a **nested type → style** control on the step's heatmap page. Top-level **type** toggles — **See clicks** (default), **See mouse moves**, **See scrolls** — switch the active overlay; only one type renders at a time (overlays are mutually exclusive). Selecting a type with two candidate styles (mouse-move, scroll) reveals a second row of **Style 1 / Style 2** buttons; **clicks** has a single style and no style row. Defaults so that a URL with no layer param renders the **clicks** view, keeping the click-precision tests (7–10, 17) valid. The existing `?view=desktop|mobile` toggle (`ViewLink` in `heatmap/page.jsx`) is independent and unchanged; type/style is the new dimension. Style buttons are intentionally plain — the losing style is dropped in Part 7. Implementation: extend `app/checkout/[sku]/heatmap/page.jsx` — filter `session.events` by `type` per view, add density/trails and fold/gradient renderers alongside the existing click-dot path (`buildAnchorAwarePoints`), and drive the active type/style from URL params (consistent with `?step=`/`?view=`). Combining two layers on one map is out of scope (post-MVP — see `PRODUCT_OVERVIEW.md` → Potential post-MVP items).

*Also in Part 6 scope (added 2026-05-24): stored `in-progress` outcome.* Commit unresolved sessions with `outcome:"in-progress"` instead of `null`, so an unfinalized session reads as an explicit state in the DB and API (not empty). Resolves to `advanced`/`completed` (success) or `abandoned` (drop-off) when finalized. **Implementation guards:** (1) the client/ingest sets `in-progress` only when committing a not-yet-finalized session; (2) `sweepCheckoutHeatmapSessions` must match `outcome IS NULL OR outcome = 'in-progress'` (with `finalized_at IS NULL`); (3) the ingest upsert must **not** let an incoming `in-progress` overwrite an already-resolved `advanced`/`completed`/`abandoned` (guard the `COALESCE` so a terminal outcome wins). Add a test that a committed, unfinalized session reads `in-progress` and flips to a terminal outcome after a sweep/advance.

**Part 7 — Mobile finger-movement capture.**

*Added 2026-05-24 — mobile finger-movement capture (was a deferred tech-debt item; pulled into scope).* Capture **finger movement on mobile** so the "See mouse moves" view is no longer empty on mobile. Approach (agreed 2026-05-24): add a `touchmove` listener in `checkoutHeatmapClient.js` that, on a mobile-classified session, records the finger's surface-relative `x/y` as `mouse-move` events (reusing the existing event type + density/trails renderers), throttled ~10 Hz like the desktop `mousemove` path. It **intentionally includes scroll swipes** (a scroll is a finger swipe; scroll *depth* keeps its own capture + the "See scrolls" view — the two are complementary: finger path vs page position). Desktop keeps `mousemove` unchanged. **Viewer:** the existing **"See mouse moves"** view (name unchanged); on **mobile view only**, the heatmap header shows a disclaimer: *"On mobile there's no mouse — here you see finger movements that include scrolling. See details for scrolling on a separate view."* (Not shown on the desktop moves heatmap.) **Tests:** update Test 31 (mobile now captures finger movement, not zero) and add a mobile moves rendering + disclaimer test (provisionally Test 43). This supersedes the "movement = desktop-only" decision and resolves the mobile touch-move tech-debt item. **Split into its own part (2026-05-24) so the close (Part 8) is not blocked by this feature work.**

**Part 8 — Choose winners + hardening + close.**

**PORT STATUS — Chunks A–F done (2026-05-25); suite 53/53 green.** The chosen renderings are implemented in `app/checkout/[sku]/heatmap/page.jsx` (+ the click-dot sites in `components/prototype/shopRuntime.js` and the top-bar slot in `components/prototype/TopBar.jsx`): **(A)** click dots encode count by opacity (`clickDotAlpha`, alpha 0.2→0.8 by `count/maxCount`; positions/radius unchanged so precision tests hold); **(B)** scroll renders the green colour-by-depth gradient + inline "<n>% saw it" legend; **(C)** mouse-move renders trails at a volume-aware stroke alpha (`trailStrokeAlpha`, ~0.5 at low volume → ~0.06 at ~1000 trails) with the floating-elements note in an optional `ShopFrame`/`TopBar` slot the heatmap page fills (live shop untouched), and the temp `?nv=` exploration code removed; **(D)** the density + fold-line overlays and the whole `?style=` toggle (`StyleLink`/`hasStyleChoice`/`readLayerStyle`) are removed — each type now has one style; **(E)** rendering Tests 39/40/43 rewritten for the single-style views + hardened against a stray funnel bounce, full suite 53/53; **(F)** the three throwaway sim pages + `.sim-shots/` deleted. **Remaining:** doc-trim pass (below) + the 2 critical tech-debt items + close gates.

**MANUAL-CHECK FIXES (2026-05-25).** Eyeballing the ported heatmap at volume surfaced two render defects, both fixed in `app/checkout/[sku]/heatmap/page.jsx`:
- **(G) Click dots — single shared scale.** `buildAnchorAwarePoints` scaled the `surface` and `fixed` buckets to **separate** maxima (each `scaleGroup` computed its own `maxCount`), so a fixed dot (sidebar/chatbot) and a surface dot could look identical despite very different counts. Now one `maxCount` is computed across **both** buckets and threaded into `scaleCheckoutHeatmapRadius` + `clickDotAlpha`; size/opacity are comparable screen-wide. Positions/radius unchanged → precision tests (7–10, 17) hold.
- **(H) Moves/scrolls — match capture layout.** The viewer renders personal-info fully expanded (`showPersonalInfoValidation` forces all "Required field" errors; `heatmapMode` opens accordions), lengthening the form vs the visitor's capture-time layout. Absolute-coordinate trails (no anchor) therefore drift **upward**, the gap growing with depth (each injected error/open panel adds height above). Fix: render the **moves and scrolls views** with validation off + accordions collapsed; the **clicks view** stays expanded (it needs the error elements present to anchor error-clicks). The half-built `validationYShift` correction in `checkoutHeatmapClient.js` is computed for clicks' metadata only and never applied to trails — left as-is. Residual limitation → `PRODUCT_OVERVIEW.md` → Tech Debt → Non-critical.
- **(I) Sessions never separated — visibility events counted as activity (capture-side).** Diagnosed via temporary `[HM]` capture logging: every return to the same step+sku resumed the same id (`ageBeforeMount` stayed <30s even after a 35s idle), so all visits merged into one `in-progress` session. Cause: `element-visible`/`element-hidden` (IntersectionObserver) events went through `recordSessionEvent` → `scheduleFinalize` → `touchResume`, resetting the inactivity timer and refreshing the resume "last seen" clock with **no user input** (and those callbacks thrash). **Partial change (NOT a full fix):** `recordSessionEvent` takes `{ resetActivity }`; visibility events pass `resetActivity:false` (recorded, but not treated as activity), while user-driven field events keep the default. Aligns code with the documented idle rule (no clicks/typing/scrolling/movement) but **does not resolve the merge** — Test 44 (`test.fixme`) still reproduces it, so at least one more passive source refreshes the resume clock. **Full fix deferred to M5 (first task)** — see `PRODUCT_OVERVIEW.md` → M5 scope. Deferred follow-ups (observer thrashing; zero-click sessions never finalizing) → Tech Debt → Non-critical.

*Choose winners + close.* Pick the better mouse-move and scroll visualisation from real data; drop the loser (or defer to M6). Run close gates: full suite green, `milestone-doc-review`, tech-debt review, `FUTURE_THIRD_PARTY_INTEGRATION.md` + `DATA.md` review, agent review, `milestone-prereqs` → READY. *Check:* the chosen views are documented; suite green; all close gates logged.

*Winners chosen (2026-05-24); visually confirmed + PORTED (Chunks A–F, 2026-05-25 — see PORT STATUS above).* Evaluated on simulated aggregates via throwaway sim pages (`app/checkout/[sku]/heatmap-sim/` for mouse-move, `app/checkout/[sku]/heatmap-scroll-sim/` for scroll — both now deleted).
- **Mouse-move = path trails.** One polyline per session over the rendered step, with **translucent** stroke so the step elements stay visible beneath the paths (density was unreadable as a winner only because it was bucketed; the user prefers seeing individual paths over the content). **Drop the density overlay** (`MouseMoveDensityOverlay`) and the mouse-move style toggle.
  - **Alpha must be volume-aware (confirmed in preview 2026-05-25).** The current `MouseMoveTrailsOverlay` stroke alpha `0.5` is fine for a few sessions but stacks into a solid blob at ~1000 sessions (form hidden). At 1000 sessions ~`0.06` stays translucent and readable. The port must use a low (and ideally session-count-aware) alpha, not `0.5`.
  - **FLOATING ELEMENTS — DECISION (2026-05-25): leave trails as-is, explain with a header note.** The trails/moves overlay renders in **surface-relative** coordinates inside `shop-content`. Two click targets are **`position: fixed`** and do **not** move with the surface: the desktop **order-summary sidebar** (`area:order-summary`) and the **chatbot icon** (`icon:chatbot`). Mouse-moves store only `x/y` + timestamp (no element link — confirmed in `checkoutHeatmapClient.js`), so for moves over a fixed element the horizontal position is reliable but the vertical smears with scroll: trails show **approximate area activity on the right**, not pointing glued to the element. **For the POC we accept this** (clicks already map fixed targets exactly via `fixedPoints`; moves will not be changed). No trail clipping/exclusion. The proper fix — tag each move with the fixed element it is over at capture time, then map to the pinned copy — is **deferred** (Tech Debt → Non-critical). Instead, add an honest header note (below).
  - **Header note (moves view) — spec (2026-05-25).** Short, subtle caption explaining the limit, **different per screen**:
    - **Desktop:** "Summary & chat float on screen, so right-side trails are approximate."
    - **Mobile:** chat-only wording — **no "right side"** (mobile has no fixed sidebar; the order summary is an inline collapsible section, confirmed shown). e.g. "Chat floats on screen, so trails near it are approximate."
    - **Layout:** keep the existing mobile finger-movement disclaimer; the float note sits **below** it (stacked, one under the other).
    - **Style + placement:** **yellow**, ~**30% smaller** than the current note, subtle; placed to the **right of the shop logo / landing link in the top bar** (not above the map). Implement via an **optional slot on the shared `TopBar` (`ShopFrame`)** that **only the heatmap page fills** — the live shop's top bar stays untouched. Shown on the **moves view only**.
    - Remove the temporary `?nv=` variant switch (added during exploration) once the stacked layout is wired.
- **Scroll = colour-by-depth.** A single **green** hue rendered as a **translucent tint** (alpha scales with the % of sessions that reached each depth — NOT `mixBlendMode: multiply`, which crushed the content), so the step shows through. Add an **inline legend**: small labels placed inside the map at the depth each shade marks, reading "<n>% saw it". **Drop the fold-line overlay** (`ScrollFoldOverlay`) and the scroll style toggle.
- **Scroll handling in the viewer — no change needed (confirmed 2026-05-25).** Moves and click dots are stored at **true full-page content positions** (scroll already folded in), so the viewer renders the step full-height and the user scrolls to see lower parts; positions map correctly. **No "fit whole page" / zoom-out view is required** (it would shrink text and hurt readability) — recorded only as a possible future convenience toggle, not built.
- **Clicks = opacity-by-count (added 2026-05-25).** Keep the existing precise per-element click dots (`buildAnchorAwarePoints` positions + `scaleCheckoutHeatmapRadius` size unchanged, so click-precision tests 7–10/17 stay valid), but drive each dot's red **alpha from its click count** (`t = count / maxCount`). Low-effort change: `maxCount`/`t` are already available in `scaleGroup`; thread them through and set the background alpha inline instead of the fixed `bg-red-500/45` class (in `ShopFrame`'s `heatmapPoints` block and the page's `fixedPoints` block). (Superseded 2026-05-25 — `maxCount` is now a **single screen-wide** value across surface + fixed dots, not per-group; see Manual-check fix (G) above.) Chosen over a blue→red hue ramp, radius+colour, and a **blurred density cloud** ("Option 4") — the cloud reads well for overall heat but loses per-element precision and would need its own toggle + tests, so it's recorded as a **post-MVP idea**, not built.
- **Net toggle change:** the nested type→style control loses its style row entirely — each remaining type (clicks / mouse-moves / scrolls) now has exactly one style. Update `app/checkout/[sku]/heatmap/page.jsx` (`StyleLink`, `hasStyleChoice`, `readLayerStyle`, the `?style=` param) and rendering tests 31/39/42/43 accordingly.
- **Visual confirmation done (2026-05-25):** trails over the real step + click mapping at **1000** sessions previewed via the sim pages; outcomes folded in above (trails need low volume-aware alpha; clicks adopt opacity-by-count; floating-element trails accepted as approximate + header note). **All pre-port decisions are now resolved** — Part 8 rendering is ready to implement.
- **Delivery sequencing — resumable chunks (decided 2026-05-25).** Part 8 implementation will likely span multiple sessions, so it is delivered in self-contained, independently testable chunks, each finished + manually verifiable in the real heatmap + relevant tests run + committed before the next begins (full suite at the tests chunk). Order, smallest/safest first: **(A)** clicks opacity-by-count → **(B)** scroll green colour-by-depth + legend → **(C)** mouse-move trails (low alpha) + header note/top-bar slot + remove temp `?nv=` code → **(D)** drop density/fold-line + the style toggle → **(E)** update/harden tests (31/39/42/43) + full suite 53/53 → **(F)** delete sim pages + `.sim-shots/`. Then the doc-trim pass + close gates. The chunk-by-chunk breakdown lives in `ONBOARDING.md` → Next action.

*Doc structure/trim pass (added 2026-05-24).* `milestone-doc-review` only catches **factual** gaps (it explicitly skips style/rewrites), so a separate structural pass is required before close. The issues below came from a readability review; they are concrete and checkable, so they stand without re-grading (grades themselves are subjective and not recorded). Review and fix each:
- **`DATA.md`** — the dead **M1 JSON-file** session/click schema and "Store file format" are the **top sections**; the live Postgres schema sits below. Reorder so the **current Postgres schema leads**; demote the M1 JSON schema to a clearly-labelled "historical" appendix.
- **`ARCHITECTURE_OVERVIEW.md`** — the "Current system goal / High-level architecture / Current data flow" sections are still **M1-framed** ("the current M1 architecture has five parts", "M1 behavior attached only to Personal Information") and read as current while sitting next to M4. Reframe to current state or mark clearly as M1 history.
- **`FUTURE_THIRD_PARTY_INTEGRATION.md`** — generic "what to document" boilerplate (the numbered checklist of *what should be documented*) adds little, and the **"M1 integration-ready state"** headers are stale framing. Trim the boilerplate; reframe the M1 sections as current.
- **`PRODUCT_OVERVIEW.md`** — very long and reads like an **append-only decision log**; current truth is buried in history. Separate active/current scope from settled-decision history so the live state is findable.
- (`ONBOARDING.md` was already trimmed 2026-05-24.)

Consider adding a standing "lean/structure" check to `milestone-doc-review` so future milestones catch this automatically.

### Tech debt context

Anticipated M4 debt to record at `milestone-start` and mark at close: mobile touch-move not captured (**resolved/scheduled — pulled into Part 7 scope 2026-05-24**); batched-pipe complexity + the at-unload beacon size limit (~64 KB); mouse-move volume vs the Neon free limit (validate against TTL); two-renderings cost in Part 6 until the loser is dropped; `outcome=completed` is step-inferred (no real purchase signal until thank-you is instrumented). Detail and final wording live in `PRODUCT_OVERVIEW.md` → Tech Debt at `milestone-start`.

## M5 architecture — login step + visitor attribution

**Status: CLOSED (2026-05-26). All 3 parts delivered; 58/58 tests green. Close gates met: `milestone-doc-review`, tech-debt review, agent review, `FUTURE_THIRD_PARTY_INTEGRATION.md` reviewed, `milestone-prereqs` → READY.** Scope frozen; spec fully specified (see `PRODUCT_OVERVIEW.md` → M5). Anticipated tech debt recorded in `PRODUCT_OVERVIEW.md` → Tech Debt → Anticipated (M5).

### Goal and boundaries

M5 inserts a lightweight login step (`step=login`) at the start of the checkout flow, before Personal Information. The visitor enters a name (required) and an optional cosmetic password. On completion a unique `visitor_id` UUID is generated and stored in localStorage; all subsequent sessions on that visit (`personal-info`, `delivery`, `pay`) are tagged with it so actions can be attributed to a specific individual.

- **In scope:** login step UI (name + password fields, CTA "Continue"); `?step=login` routing; step nav exclusion; `visitor_id` UUID generation (localStorage); `visitor_id` written to the `sessions` table and round-tripped through the ingest path.
- **Out of scope (POC deferral):** credential validation; real auth; `visitor_id` in the query API; heatmap capture on the login step.

### Architecture changes

- **`components/prototype/CheckoutFlow.jsx`:** add a `login` case to the step renderer — two fields (name required, password optional/cosmetic), CTA "Continue". Step nav (step pills / breadcrumb) explicitly excludes `login`.
- **`components/prototype/shopRuntime.js` / `app/checkout/[sku]/page.jsx`:** `?step=login` becomes the checkout entry point; Continue (with non-empty name) advances `login → personal-info`; existing `advanced`/`completed` outcome wiring is unchanged for subsequent steps.
- **`lib/prototype/checkoutVisitorId.js` (new):** `mintVisitorId()` — generates a UUID and writes it to localStorage (`m1.heatmap.visitorId`). Called once on login Continue. `getVisitorId()` — reads the stored value; returns `null` if absent (visitor arrived without going through login).
- **`lib/prototype/checkoutHeatmapClient.js`:** on init for `personal-info`/`delivery`/`pay`, read `visitor_id` from localStorage via `getVisitorId()` and include it on every session payload sent to `/ingest`.
- **`lib/prototype/checkoutHeatmapStore.server.js`:** `ingestCheckoutHeatmapBatch` writes `visitor_id` to the `sessions` upsert. Uses `COALESCE(existing, incoming)` so a late beacon from a resumed session never overwrites an already-set id.
- **`lib/prototype/checkoutHeatmap.js`:** `normalizeCheckoutHeatmapSession` round-trips `visitor_id` (read from DB row, exposed on the session object).
- **`scripts/db-setup.mjs`:** `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT` — idempotent; must be run against **both** `public` and `heatmap_test` schemas before any login-step code is tested.

### Files expected to change / be added

- **New:** `lib/prototype/checkoutVisitorId.js`
- **Changed:** `components/prototype/CheckoutFlow.jsx`; `components/prototype/shopRuntime.js` (or `app/checkout/[sku]/page.jsx`); `lib/prototype/checkoutHeatmapClient.js`; `lib/prototype/checkoutHeatmapStore.server.js`; `lib/prototype/checkoutHeatmap.js`; `scripts/db-setup.mjs`; `Documentation/DATA.md` (new `visitor_id` column); test specs.

### Implementation plan (3 parts — each part ends with a manual check)

**Part 1 — Schema migration + login step UI.**
- Apply `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT` in `db-setup.mjs`; run against both `public` and `heatmap_test`.
- Add the login step to `CheckoutFlow.jsx`: name field (required), password field (optional, cosmetic), CTA "Continue".
- Wire `?step=login` routing: checkout entry point becomes `login`; Continue with a non-empty name advances to `personal-info`; empty name blocks and shows a validation message.
- Exclude `login` from the step nav (step pills / breadcrumb).
- *Manual check:* navigate shop → add to cart → checkout opens on the **login screen**; step nav shows Personal Information | Choose Delivery | Pay & Finish (**no Login**); submit with empty name → blocked; fill name → Continue → lands on Personal Information.

**Part 2 — Visitor ID generation + session attribution.**
- `checkoutVisitorId.js`: `mintVisitorId()` generates a UUID and writes to localStorage on login Continue; `getVisitorId()` reads it back.
- Wire `mintVisitorId()` call into the login Continue handler in `CheckoutFlow.jsx` / `page.jsx`.
- `checkoutHeatmapClient.js`: on init, call `getVisitorId()` and attach to the session payload.
- `checkoutHeatmapStore.server.js`: write `visitor_id` in `ingestCheckoutHeatmapBatch` (COALESCE-protected upsert).
- `checkoutHeatmap.js`: `normalizeCheckoutHeatmapSession` round-trips `visitor_id`.
- `DATA.md`: document the new `visitor_id` column.
- *Manual check:* complete login → drop off on Personal Information → inspect DB (direct query) → session row has `visitor_id` set; create a second drop-off in the same browser without logging in again → same `visitor_id` on both rows; open an incognito window, complete login again → a different `visitor_id`.

**Part 3 — Tests + close gates.**
- Write new test cases (exact numbers assigned after `milestone-test-planning`): login step renders; empty name blocks Continue; valid name advances to Personal Information; `visitor_id` is written to localStorage on login; subsequent sessions carry that `visitor_id` in DB; a second login mints a new `visitor_id`.
- Full suite green (54 active carried + new M5 tests).
- *Manual check:* run `scripts/run-playwright-isolated.ps1` → all tests pass.

### Tech debt context

Anticipated M5 debt identified at planning: `visitor_id` in localStorage (POC stand-in; server-side identity deferred to M8); new UUID per login (no cross-visit continuity); `visitor_id` not in query API; login step not heatmap-captured; no credential validation; step nav exclusion hardcoded; schema migration must reach both schemas. Detail and outcomes at close in `PRODUCT_OVERVIEW.md` → Tech Debt → Anticipated (M5).

## M6 architecture — admin dashboard

**Status: IN PROGRESS — Parts 1–3 done (2026-05-27): outcome-model unification (P1); runtime config store + API (P2); capture reads runtime config with server-side ingest gate (P3). Parts 4–6 to follow.** Scope frozen + fully specified (`PRODUCT_OVERVIEW.md` → M6 → "Decisions agreed (2026-05-27)"). This section is the architecture + phased implementation plan required by the `milestone-start` gate. Anticipated tech debt recorded in `PRODUCT_OVERVIEW.md` → Tech Debt → Anticipated (M6). The test plan is produced separately by `milestone-test-planning`; this section names the known test impacts so that plan can account for them.

### Goal and boundaries

M6 adds a single-page **admin dashboard** (secret-link auth) with three stacked sections — **Data → Heatmap → Report** — through which an admin configures *what is captured*, *views the heatmap*, and (placeholder) *generates a report*. Three pieces touch **built code + tests**, not just new UI: (1) capture becomes **runtime-config-driven** (step / element-type / event-type / sampling toggles that actually start/stop capture, replacing the env-based sampling rate); (2) the **outcome model is unified** (`advanced` collapses into `completed`); (3) the **Shop header heatmap controls are removed** and live only in the dashboard.

- **In scope (dashboard):** a `/dashboard` route gated by a shared secret token (env), styled like the Shop, narrow/centered, **desktop-only**. **Data** section = 8 config items + a **Save** button (staged edits apply on Save; toggles for steps / element-types / event-types / sampling actually start/stop **live capture**; clear-data is immediate behind a confirmation pop-up and wipes ALL data). **Heatmap** section = filters (step / desktop·mobile icons / view type / timeframe / outcome) → a button that opens the configured heatmap in a **new tab** via URL params (no Save). **Report** section = a placeholder button (real report is M7).
- **In scope (runtime config):** a durable config store (Postgres) read by the capture client and written by the dashboard Save; enable/disable actually gates capture; sampling rate moves from `NEXT_PUBLIC_HEATMAP_SAMPLING_RATE` env to runtime config; capture window (date range during which data is recorded) gates capture.
- **In scope (outcome model):** collapse `advanced` + `completed` into a single `completed` ("completed *this* step"); relabel existing `advanced` DB rows; update code, tests, and docs. Purchase/conversion remains explicitly out of scope.
- **In scope (viewer):** an **outcome filter** (drop-offs = `abandoned` / completers = `completed` / all incl. `in-progress`) and a **timeframe view-window** (`from`/`to`), both driven by URL params the dashboard sets.
- **In scope (Shop):** delete the header Heatmap dropdown, Clear-data button, desktop/mobile + clicks/moves/scrolls toggles, and the moves/scrolls header note from the live Shop — **delete, not hide**. After M6 the live Shop renders with no heatmap/admin UI; visitors never see these controls.
- **Out of scope (POC deferral):** raw-data export UI (dropped — the backend queries Postgres directly); real account-based auth / audit log / RBAC (M8); durable multi-instance config service + concurrent-admin safety (M8); the real report pipeline (M7); dashboard responsive/mobile layout and UI polish; event-level throttle (display-only in M6).
- **Scoped back in (2026-05-27):** the **drop-off threshold is now admin-editable** (was previously deferred as display-only). Stored as `config.inactivityMs` (ms); the dashboard offers presets (10s / 30s / 1m / 2m / 5m), defaulting to `30000`. The capture client applies it after the background config fetch (an explicit `inactivityMs` prop or `automation` still overrides, for tests). Persisted per-session in the existing `inactivity_ms` column, so the server sweep finalizes drop-offs at the configured idle time.

### Config storage decision (recommended: Postgres)

The runtime config is backed by a **single-row `heatmap_config` table** in the existing Neon store, selected through the same `HEATMAP_DB_SCHEMA` mechanism as `sessions`/`events`. Rationale: capture is **client-side across many visitor browsers**, so the config must be server-persisted and fetchable by every visit — an in-memory or JSON-file store does not survive the M8 Vercel/serverless target and is not test-isolated. Reusing Postgres is *less* work than a JSON file with atomic writes, is consistent with the session store, and is auto-isolated in `heatmap_test` so the suite can set config per test without touching `public`. **This downgrades the anticipated "ephemeral config storage" debt** (the config now survives restarts); the residual M8 concerns — multi-instance feature-flag service, concurrent-admin write safety — still stand. *(Recorded 2026-05-27; revisit if a non-DB store is preferred.)*

### Architecture changes

- **Dashboard route + auth gate (`app/dashboard/page.jsx`, new; `lib/prototype/dashboardAuth.js`, new).** A top-level (product-wide, not per-sku) route. Access is a **secret link** `/dashboard?token=<token>` validated server-side against a `DASHBOARD_TOKEN` env var; a missing/wrong token renders a not-authorized state (no dashboard content, no config leak). `dashboardAuth.isAuthorizedToken(token)` does a length-safe constant-time compare and is reused by every auth-gated API route. **Revocation = rotate `DASHBOARD_TOKEN`** → all links die; the admin generates and re-shares a new one. The page reuses Shop styling (`components/ui/*`, the Shop palette/fonts) so it feels part of the product; section headers (Data / Heatmap / Report) render larger/bold; a heatmap blob icon with **breathing** hotspot dots (subtle pulse animation) is used per the agreed visual.
- **Runtime config store + API.** New `app/api/checkout-heatmap/config/route.js`: **`GET` is public** (the capture client reads it on every visit) and returns the active config (or defaults when no row exists); **`POST`/`PUT` is auth-gated** (dashboard Save) and upserts the single config row. Store helpers (in `checkoutHeatmapStore.server.js` or a new `heatmapConfigStore.server.js`): `getHeatmapConfig()` / `saveHeatmapConfig(config)`. A defaults module makes "no saved config" behave **exactly like today** — all steps on, all element types on, all event types on, sampling = 1 (100%), capture window open — so the dashboard is purely additive until an admin saves.
- **Capture reads runtime config (`checkoutHeatmapClient.js`, `checkoutHeatmapSampling.js`).** On capture init (after, and in addition to, the existing sampling gate), the client fetches the active config and **gates capture by it**: the current `step` disabled → capture fully off (early return, like the unsampled path at `checkoutHeatmapClient.js:60`); a disabled **event type** skips attaching/recording that listener (e.g. mouse-move off → no `mousemove`/`touchmove` capture; clicks off → no click capture); a disabled **element type** drops events whose resolved anchor `type` is off; the **capture window** gates on `now ∈ [from,to]`. The fetch **fails open to today's defaults** so a transient config-read error never silently loses capture (protects the resolved event-delivery-reliability invariant). **Sampling rate precedence becomes:** `heatmapSampleRate` query-param override (tests/manual) → **runtime config** → env (`NEXT_PUBLIC_HEATMAP_SAMPLING_RATE`, now a seed/fallback) → default 1. **Sampling is per-session (corrected 2026-05-27):** each session (one step visit) is sampled independently — the product measures per-step conversion, not whole journeys — so the per-visitor `m1.heatmap.sampled` cookie was removed. A new session flips its own coin at the effective rate once the config loads; a resumed session keeps its in-sample decision; 0%/100% stay deterministic. The probabilistic decision is client-side; the server ingest gate still enforces only 0%/step/window.
- **Save model.** Data-section edits are **staged client-side** and applied only on **Save** (one upsert writes steps + element types + event types + sampling + capture window + drop-off threshold together). **Clear-data is exempt** — its own immediate action behind a confirmation pop-up, calling the (now auth-gated) `DELETE /api/checkout-heatmap`, wiping ALL recorded data (every step/view/timeframe), matching today's clear-data semantics.
- **Outcome-model unification (`checkoutHeatmap.js`, `app/checkout/[sku]/page.jsx`, `checkoutHeatmapStore.server.js`, `checkoutHeatmapClient.js`).** Remove `ADVANCED` from `CHECKOUT_HEATMAP_OUTCOMES`; `completed` becomes the single success outcome meaning "completed this step," and `CHECKOUT_HEATMAP_TERMINAL_OUTCOMES` drops `advanced`. The `setStep` advance handler (`page.jsx:80`) flushes `completed` instead of `advanced`; `onFinish` (`page.jsx:93`) already flushes `completed`. The `in-progress`-must-not-overwrite-terminal guard (M4 Part 6) is unchanged. **DB migration:** a one-time idempotent `UPDATE "<schema>".sessions SET outcome='completed' WHERE outcome='advanced'`, run against **both** `public` and `heatmap_test` (added to `scripts/db-setup.mjs`, the same pattern as the M5 `visitor_id` add).
- **Viewer outcome filter + timeframe (`app/checkout/[sku]/heatmap/page.jsx`).** Read new `outcome` and `from`/`to` params alongside the existing `step`/`view`/`type`. The session filter (today `view === selectedView && step === selectedStep`, `page.jsx:85`) gains an **outcome predicate** — drop-offs → `abandoned`, completers → `completed`, all → no outcome restriction (includes `in-progress`) — and a **timeframe predicate** on the session timestamp. At POC volume the viewer keeps fetching `GET /api/checkout-heatmap` and filters client-side (minimal change); extending `/api/checkout-heatmap/query` to also filter by `outcome` is the scalable follow-up, not required for M6. A selection (step/view/timeframe/outcome) with no matching data shows the **no-data message**.
- **Shop header-button removal (`components/prototype/TopBar.jsx` + callers).** Delete the `showM1Actions` block (Heatmap step dropdown + Clear-data button) and the live-Shop `note` slot usage; callers in `shopRuntime.js` / the checkout page stop passing those props. The dashboard's Heatmap section becomes the **sole entry point** to the viewer (it builds `?step=&view=&type=&from=&to=&outcome=` and opens a new tab), and Clear-data lives only in the dashboard Data section. The heatmap **viewer page** keeps rendering from URL params and keeps the top-bar moves note slot it fills itself (that is the viewer, not the live Shop); its now-redundant in-page toggle UI may be trimmed but the hard requirement is removing the controls from the live Shop.

### Files expected to change / be added

- **New:** `app/dashboard/page.jsx` (+ dashboard section components / the breathing heatmap icon); `app/api/checkout-heatmap/config/route.js` (public GET / auth-gated POST); `lib/prototype/dashboardAuth.js`; config defaults + store helpers (in `checkoutHeatmapStore.server.js` or a new `heatmapConfigStore.server.js`).
- **Changed:** `scripts/db-setup.mjs` (`heatmap_config` table DDL + `advanced`→`completed` migration, both schemas); `lib/prototype/checkoutHeatmap.js` (outcome enum); `lib/prototype/checkoutHeatmapClient.js` (config-gated capture + sampling-from-config + outcome rename); `lib/prototype/checkoutHeatmapSampling.js` (rate precedence: config before env); `lib/prototype/checkoutHeatmapStore.server.js` (config store + auth-gated DELETE + outcome rename); `app/api/checkout-heatmap/route.js` (gate `DELETE` on the token); `app/checkout/[sku]/page.jsx` (`advanced`→`completed`); `app/checkout/[sku]/heatmap/page.jsx` (outcome filter + timeframe); `components/prototype/TopBar.jsx` + `shopRuntime.js` (remove header controls); `.env.example` (add `DASHBOARD_TOKEN`); `Documentation/DATA.md` (config table + outcome change); `Documentation/FUTURE_THIRD_PARTY_INTEGRATION.md` (auth/config seams + outcome); `.claude/agents/heatmap-qa.md` (outcome + capture-gating).
- **Unchanged contract:** `GET / POST /api/checkout-heatmap`, `/ingest`, `/query`, `/sweep`, `/cleanup` keep their shapes (auth + config are additive; only `DELETE` gains a token check). The capture write path (`/ingest`) stays public — visitor browsers post to it without the dashboard token.

### Known test impacts (for `milestone-test-planning`)

- **Test 37** (`m4-session-signals.spec.ts`) asserts `advanced` on the personal-info/delivery sessions → must become `completed`.
- **Test 2** (Clear data) and **Test 3** (Heatmap step dropdown opens a new tab) click the **Shop header** controls that M6 deletes → need a new path (Clear-data via the dashboard / auth-gated `DELETE`; heatmap-open via the dashboard Heatmap button). Any flow helper that opens the heatmap via the header is affected.
- **New coverage** the plan must add: dashboard auth (valid token renders / wrong token blocked), config Save → capture actually starts/stops (step / element-type / event-type / sampling), clear-data confirmation wipes all, outcome filter (drop-offs / completers / all), timeframe view-window + out-of-range no-data message, and the public config `GET` defaults.

### Implementation plan (phased — each part ends with a manual check)

M6 is delivered in sequential parts; the next part does not begin until the current one's manual check is confirmed (same discipline as M2–M5). The two built-code tasks (outcome unification, header removal) are sequenced so the suite stays green: the rename lands first with its test update; the header removal lands last, after the dashboard provides the replacement path.

**Part 1 — Outcome-model unification (`advanced` → `completed`).** Update the outcome enum + terminal set, the `setStep` advance flush, and all `advanced` references in code; add the idempotent `UPDATE … SET outcome='completed' WHERE outcome='advanced'` to `db-setup.mjs` and run it against both schemas; update `DATA.md` / this doc / `FUTURE_THIRD_PARTY_INTEGRATION.md` / `heatmap-qa.md`; update Test 37. *Manual check:* advance personal-info → delivery → pay → each finished step's session reads `completed` (not `advanced`); a direct DB query shows no remaining `advanced` rows; full suite green.

**Part 2 — Runtime config store + API + defaults (no UI yet).** Add the `heatmap_config` table (DDL in `db-setup.mjs`), the config store helpers, the defaults module (= today's behavior), `dashboardAuth.js` + `DASHBOARD_TOKEN`, and `GET` (public) / `POST` (auth-gated) `/api/checkout-heatmap/config`. Capture still runs on defaults. *Manual check:* `GET /api/checkout-heatmap/config` returns defaults with no row; `POST` with the token writes a config that persists across a dev-server restart; `POST` without/with a wrong token is rejected.

**Part 3 — Capture reads runtime config.** Wire `checkoutHeatmapClient.js` to fetch the active config on init and gate capture by step / element-type / event-type / capture-window, failing open to defaults; move the sampling-rate source into config (`checkoutHeatmapSampling.js` precedence). *Manual check:* with capture running, disable an event type (e.g. mouse-move) or a step in the config row → that capture stops on the next visit; re-enable → it resumes; set sampling to 0% → no sessions; 100% → captured.

**Part 4 — Dashboard shell + auth gate + Data section. DONE (2026-05-27).** Built `/dashboard?token=` route (Shop-styled, `max-w-[33.6rem]`, desktop-only). All three sections (Data / Heatmap / Report) live inside **one rounded rectangle** separated by thin lines — no nested boxes. **Data section** controls — each a labeled row (label left / control `w-44` right): **Steps** (MultiSelect popover with Select all / Clear), **Data collecting timeframe** (preset dropdown: Today / Last week / Last month / Custom; Custom reveals From/To date pickers inside the same popover — no layout push), **Drop off timeframe** (configurable preset dropdown: 10s / 30s / 1m / 2m / 5m — wired to `config.inactivityMs`; was display-only; now fully configurable end-to-end), **Sampling Rate**, **Event Types** (MultiSelect), **Element Types** (MultiSelect) — all with **staged edits + one Save**. **Clear-data**: trash icon in the Data section header → confirmation overlay (immediate, exempt from Save). Config change: `inactivityMs: 30000` added to `getDefaultHeatmapConfig()` (`lib/prototype/heatmapConfigStore.server.js`); `checkoutHeatmapClient.js` now reads `runtimeConfig.inactivityMs` after background fetch and applies it as the live inactivity threshold (explicit prop or `automation` flag still overrides — test fixtures unaffected). Test 54 added in `tests/e2e/m6-dashboard.spec.ts` (auth gate + Data section Save + Clear-data). *Note:* Test 54 step assertions use the old checkbox API — needs update to MultiSelect selectors before suite run. *Manual check:* open with the token → dashboard renders (wrong token → blocked); change steps/types/sampling + Save → `GET /api/checkout-heatmap/config` reflects the change; change drop-off timeframe + Save → capture applies the new threshold on next visit; Clear-data confirm → all data wiped.

**Part 5 — Heatmap section + viewer outcome filter + timeframe.** Dashboard **Heatmap** section: step dropdown, desktop/mobile **icon** selector, view-type dropdown (clicks/moves/scrolls), timeframe (view window), outcome dropdown (drop-offs/completers/all) → a button that opens the viewer in a new tab with all params; the breathing heatmap icon. Extend `heatmap/page.jsx` to read `outcome` + `from`/`to` and filter sessions accordingly (the outcome aggregation change + the view-window). *Manual check:* set filters → open → the viewer shows only the filtered set; outcome = drop-offs shows only `abandoned`, completers only `completed`, all shows everything incl. `in-progress`; a timeframe outside captured data shows the no-data message.

**Part 6 — Remove Shop header controls + Report placeholder + close.** Delete the Heatmap dropdown, Clear-data, view/type toggles, and the moves/scrolls note from the live Shop `TopBar` + callers (delete, not hide); add the **Report** placeholder button (disabled / "not yet implemented"); rewrite Tests 2/3 (and any header-dependent helper) onto the dashboard / auth-gated-API path; run close gates. *Manual check:* the live Shop renders with **no** heatmap/admin UI; the dashboard is the only way to view the heatmap or clear data; full suite green; close gates logged (`milestone-doc-review`, tech-debt review with all critical items resolved, agent review, `FUTURE_THIRD_PARTY_INTEGRATION.md` + `DATA.md` review, committed/clean tree, `milestone-prereqs` → READY).

### Tech debt context

Anticipated M6 debt identified at planning (full wording in `PRODUCT_OVERVIEW.md` → Tech Debt → Anticipated (M6)): ~~config storage ephemeral~~ (**downgraded by the Postgres decision above** — config now persists across restarts; multi-instance/concurrency remains M8); secret-token auth is brittle (one shared token, no identity/audit/RBAC — M8); no concurrent-admin write safety; dashboard UI minimal (no responsive/a11y polish); M6 test coverage is core-path focused; report generation is a placeholder (M7); suite-runtime growth from the new tests.
