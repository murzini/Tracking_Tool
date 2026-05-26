# Future Third Party Integration

## Purpose

This document captures the integration-facing parts of the Shop sandbox product that should be kept explicit while the POC evolves.

The goal is not to design full production integration early. The goal is to keep stable seams documented so the product can later be integrated into external products without unnecessary rework.

## Current status

- The Shop sandbox is still a POC and remains the primary implementation and validation environment.
- Integration into external products is a later-stage goal, not current milestone scope.
- We should prepare for integration lightly and deliberately, without over-engineering unstable flows.

## What to keep documented

Keep the integration-facing essentials explicit — concrete current values live in the sections below and in `Documentation/DATA.md`:

- **Stable data models** — session + event shapes, aggregation shape, view values, metadata. For each: field names, meaning, required/optional, accepted values, and whether it is milestone-specific or durable.
- **API contracts** — route, method, purpose, request/response shape, error behavior, and whether the contract is stable / provisional / milestone-only.
- **Configurable business rules** — current default, why it exists, and whether it is expected to vary (inactivity threshold, tracked interaction types, drop-off definition, view breakpoints, radius bounds, screen inclusion).
- **Integration seams** — keep the capture / storage / aggregation / rendering / UI-only-sandbox boundaries distinct, so core logic is reusable without inheriting sandbox-specific code.
- **Naming & evolution** — avoid needless renames, prefer additive changes, document breaking changes, and record milestone context for temporary fields. Define a versioning/migration policy here if it becomes relevant.

**Not yet:** no heavy production integration architecture, no enterprise API docs for unstable flows, no premature abstraction, and no optimizing for unknown target systems before real integration constraints are known.

## Integration-ready state — baseline (M1–M2)

The core integration-facing facts established by M1–M2. M3 (Postgres + query API) and M4 (rich events, outcomes, batched ingest, sampling) extended these — see the M3 section below and `Documentation/DATA.md`.

### Data concepts (baseline)

- Each opening of a checkout step is treated as a new session (any of `personal-info`, `delivery`, `pay`; sessions carry the `step`). *(M4 refines this: a return within window X resumes the same session — see "Session resume and external re-entry".)*
- M1–M2 persisted only drop-off sessions. **M4 now records all sessions**, each tagged with an `outcome` (`advanced` / `completed` / `abandoned` / `in-progress`) so completers can be compared against non-completers — see the M3/M4 notes and `DATA.md`.
- A drop-off requires at least one interaction, then inactivity for the configured threshold. *(M4 also records zero-interaction bounces.)*
- Clicks are stored as element-anchor offsets: `{ anchor: { id, dx, dy } }` where `id` is the stable identifier of the nearest tracked UI element. For clicks directly on an element, `dx`/`dy` are `0` (dot snaps to element center); for free-space clicks they capture the offset from the nearest element's center. This replaced the earlier raw-pixel approach.
- Each click also carries element metadata at capture time: `label`, `role`, `tagName`, `field name`, and click offset within the element — the foundation for future engagement reporting (grouping interactions by checkout element rather than by pixel position).
- The element registry (`CHECKOUT_ELEMENT_REGISTRY`) is an auto-maintained scanner snapshot covering all checkout steps. Each entry has a stable `id`, `type`, `label`, a `steps` list, and an `addedAt`/`removedAt` lifecycle. Entries are never deleted — removed elements are marked with `removedAt`. Only tagged anchors are recorded; untagged elements are resolved live by the scanner.
- At render time, anchor ids are resolved to live DOM elements via `data-heatmap-id` attributes.
- Heatmaps are separated by `desktop_view` and `mobile_view`, and aggregate across all backpacks per checkout step (filtered by `step` + `view`).

### Configurable rules (baseline)

- Default inactivity threshold: `30000ms`.
- Default automation (test) inactivity threshold: `2000ms` (activated via `m1HeatmapTest=1` query param or `overrideMs`).
- Radius bounds: `6px` minimum, `24px` maximum.
- View classification breakpoint currently derives from the desktop breakpoint in the Shop UI.

### Durable API boundary candidates

- `GET /api/checkout-heatmap` — read persisted heatmap sessions.
- `POST /api/checkout-heatmap` — append one finalized drop-off session. *(Kept for back-compat; since M4 Part 2 the client writes via `/ingest` instead — see M3/M4 contracts below.)*
- `DELETE /api/checkout-heatmap` — clear persisted heatmap history.

These are still POC-level contracts and may evolve, but they should be tracked here when changed.

## M3 integration-ready state

M3 moved the store to a database and added a query layer. The integration-facing changes:

### Data model changes (M3)

- **Storage backend:** the local JSON file store is replaced by Neon Postgres (`sessions` + `events` tables). The `GET / POST / DELETE /api/checkout-heatmap` contract is unchanged, so existing consumers are unaffected by the swap.
- **`clicks[]` → `events[]`:** the captured interaction array is generalised. A click is now an event with `type: "click"`; type-specific data (anchor, target, uiState) lives in an extensible `detail` payload (JSONB column). This is the durable shape intended to carry M4 event types (`scroll`, `field-focus`, `field-blur`, `field-change`, `validation-error`, `element-visible`, …) without a schema migration. `normalizeCheckoutHeatmapSession` accepts both `events[]` (current) and legacy `clicks[]` as input and always outputs `events[]`.
- **New session fields:**
  - `outcome` — `abandoned` | `completed` | `advanced`. All sessions are recorded (not just drop-offs) so completers can be compared against non-completers. Inactivity-finalized sessions are `abandoned`; completed/advanced are written from M4.
  - `samplingRate` — effective rate = external % (host traffic share) × internal % (our visitor-level rate). Field stored in M3; the sampling *mechanism* is M4. Drop-off ratios need no adjustment; absolute counts are scaled by this rate at report time.

Field meaning, required/optional status, and milestone context for these are detailed in `Documentation/DATA.md`.

### API contracts (M3)

- `GET /api/checkout-heatmap/query?step=&view=&from=&to=`
  - Purpose: read-only retrieval of sessions filtered by step, view, and timeframe. Returns `{ ok: true, sessions: [...] }`.
  - Status: provisional. No access control and no pagination yet (both tracked as tech debt; auth → M6, the read layer hardens in M8).
- `POST /api/checkout-heatmap/cleanup`
  - Purpose: TTL/archival cleanup to stay under the storage budget. Accepts `{ before }` (ISO cutoff) or `{ ttlDays }` (default 30); deletes sessions whose `finalized_at` precedes the cutoff. Returns `{ ok, deleted, before }`.
  - Status: provisional POC maintenance contract.

### Configurable rules (M3)

- **Effective sampling rate** (`samplingRate`): default `1` (100%). Exists so absolute counts can be scaled when only a fraction of traffic is captured. Expected to vary per host/market. The external-rate signalling/limiting mechanism is an **M8** integration contract.
- **Retention / TTL:** default 30 days (cleanup endpoint). Expected to vary by storage budget and host data-governance rules.
- **DB schema selection** (`HEATMAP_DB_SCHEMA`, default `public`; `heatmap_test` for tests): an operational/config seam, not an external contract.

### Scale and ingestion

The batching, ingestion, and sampling design for host-scale traffic (thousands/day) is documented in `Documentation/SCALE_DESIGN.md`. M3 is design-only here; the batched ingest pipe and sampling gate are built in M4. This is consistent with the "Embedding architecture → Capture side" note that the snippet sends *batched* event data to the product API.

## M4 integration-ready state

M4 built the batched capture pipe + sampling gate and captured the full event set. Integration-facing changes:

### Data model changes (M4)

- **Rich events captured.** Beyond click/tap: `mouse-move` (desktop mouse + mobile finger via `touchmove`), `scroll` (depth), `field-focus` / `field-blur` / `field-change` (filled/length only — **never the raw value**), `validation-error`, and `element-visible` / `element-hidden` (with visible duration). All ride the `events.type` + JSONB `detail` shape defined in M3 — no schema migration. Field definitions live in `Documentation/DATA.md`.
- **Session outcome states.** `outcome` now takes `advanced` / `completed` (success, on step navigation), `abandoned` (drop-off), and `in-progress` (committed-but-unfinalized). `exit_reason` (`idle` / `nav-click` / `back` / `left-browser`) records how a non-completed step was left. `step_active_ms` / `step_idle_ms` split time-on-step (`active + idle = duration`). All durable, queryable fields — see `DATA.md`.

### API contracts (M4)

- `POST /api/checkout-heatmap/ingest` — **the live write path.** Body `{ session, events:[...] }`. Idempotent: events `ON CONFLICT (id) DO NOTHING`; session upsert is COALESCE/GREATEST-protected, so re-delivery never dupes or erases a finalized result. The client streams batches here (interval/size flush via `fetch` `keepalive`, unload flush via `sendBeacon`). **Stable** for the POC; the snippet-based capture transport (Embedding architecture → Capture side) builds on this batch shape.
- `POST /api/checkout-heatmap/sweep` — lazy/derived finalize (there is no always-on runtime): marks stale unfinalized sessions `abandoned` after the grace window. Body `{ now?, force? }`. **Provisional POC mechanism** — in production a scheduled job or queue replaces the request-triggered sweep (M8).
- Legacy `POST /api/checkout-heatmap` is kept for back-compat but is no longer called by the client.

### Configurable rules (M4)

- **Visitor sampling gate:** a per-visit decision persisted in the `m1.heatmap.sampled` cookie; rate resolves `heatmapSampleRate` query param → `NEXT_PUBLIC_HEATMAP_SAMPLING_RATE` env → default `1` (100%). If a visit is not sampled, capture is fully off. The dashboard control is M6; the external-rate contract is M8.
- **Mouse/finger-move throttle:** ~100 ms (≈10 Hz). Tunable; the path-fidelity vs volume trade-off is revisited at real scale (M8).
- **Resume window `X`:** see "Session resume and external re-entry" below.

## Scan new page

When the product is pointed at a new page or checkout step, the following approach determines which elements get tracked.

### Step 1 — Automatic discovery (conventional elements)
The scanner runs against the rendered DOM and identifies all elements that match the configured ruleset. The ruleset defines trackable element types (e.g. `input`, `select`, `button`, `[role="checkbox"]`, `[role="radio"]`). Each matched element is assigned a stable ID and registered automatically. No manual tagging is required for these.

The ruleset lives in a dedicated config file and can be extended at any time. Individual element types can later be enabled or disabled via the admin dashboard without code changes.

### Step 2 — Manual tagging (custom elements)
The scanner only finds what it recognises. Any element that does not match the configured ruleset will be missed. A human must review the page after the scanner runs and identify any custom components that are not being captured.

Custom elements are tagged manually with a `data-heatmap-id` attribute. Any element carrying this attribute is tracked regardless of whether it matches the config rules. This is the escape hatch for host-app-specific UI components.

### Step 3 — Combined registry
Both conventional (auto-discovered) and custom (manually tagged) elements end up in the same registry and are tracked identically. The capture and heatmap logic does not distinguish between them.

### Integration checklist for a new page
1. Run the scanner against the rendered page
2. Review the output — confirm all expected elements were found
3. Identify any custom elements the scanner missed
4. Tag missed elements with `data-heatmap-id`
5. Re-run and confirm full coverage

For the real product integration (Autohero), this checklist is part of M8 scope.

### Step list configuration

The heatmap viewer's step selector (the **Heatmap** dropdown) is driven by a configured list of steps — it is **not hardcoded**. The same scanner runs per configured step, so adding a step is configuration, not code.

- **Sandbox (M2):** the step list is a local config (`personal-info`, `delivery`, `pay`). The dropdown renders one entry per configured step; selecting one opens that step's heatmap via `?step=`.
- **Real product:** the host integration supplies the step list — which screens/steps are covered — as configuration passed to the product. No per-step code is written.
- **From M6:** an admin configures which steps are covered through the dashboard (no code changes), and the dropdown reflects that configuration.

The active step is also passed explicitly to the capture client on initialisation (not auto-detected from the DOM), so the host app declares the current step rather than the library guessing it.

## Embedding architecture

The product has two distinct integration surfaces that require different embedding strategies.

### Capture side

A JavaScript snippet injected into the host product's `<head>` (similar to Google Analytics). The snippet loads the tracking library, attaches event listeners, and sends batched event data to the product's API. This approach is stack-agnostic and non-invasive — the host app does not need to change its build pipeline or adopt any framework dependency.

The one integration requirement on the host app side: `data-heatmap-id` attributes must be present on the elements to be tracked. These stable identifiers are the contract between the host app and the capture library. The host app team is responsible for adding and maintaining them.

### Viewer side (heatmap and admin dashboard)

The heatmap viewer requires an accurate visual replica of the host product's page as its surface. Two approaches are viable:

- **Iframe overlay (preferred long-term):** The actual host page is loaded in an iframe. The dot overlay is drawn on top. Always pixel-accurate and stays in sync with UI changes automatically. Complicated by CORS, authentication, and dynamic content — requires deliberate setup from the host app.
- **Standalone viewer (current approach, valid for POC and M8):** The viewer renders its own replica of the tracked page. Simpler to build and deploy. Requires manual effort to keep the replica in sync when the host app's UI changes.

The iframe overlay is the right long-term answer for accuracy and maintainability. The standalone viewer is acceptable while the POC is being validated.

### M8 scope implication

M8 (integration readiness) must decide which viewer approach to pursue and produce the concrete integration contract: the snippet API, the `data-heatmap-id` convention, CORS and auth requirements if the iframe path is chosen, and any configuration needed for the host app to point capture traffic at the product's API.

## Session resume and external re-entry

A checkout visit is not always a single uninterrupted sitting. A visitor can leave a step and return to it later, and the **same** session must resume (same session ID, events keep appending) rather than starting a fresh one.

### POC behavior (M4)
- Resume is governed by a single configurable window **X**: return within X → resume the same session; otherwise a new session. Default X = `30000ms` (normal) / `2000ms` (autotests).
- Finalization is deferred until X elapses with no return (server-side timeout sweep). The exit beacon flushes buffered events but does not close the session.
- The session ID persists across the leave/return gap (cookie/`sessionStorage` + a "left-at" timestamp).
- This is deliberately simple — one window, in-product returns only.

### Real-product requirement (Autohero, M8 — not built in the POC)
In production, a visitor can re-enter a started checkout through **external entry points**, potentially **days or weeks** later:
- a **drop-off email** link (we email visitors who left), and
- the **Account Dashboard** (a section listing checkouts the visitor has started),
- and possibly other host-defined paths.

Conceptually this is still "resume within X" — production simply uses a much **longer** X. But a long X splits the timing into **two windows** that the POC's single-window model collapses:
- **Finalize/abandon window (short):** after a brief idle the session is marked `abandoned` so downstream actions (e.g. the drop-off email) can fire.
- **Resume window X (long):** within X a returning visitor **reopens** that session — so an `abandoned` session must remain **reopenable**, not closed forever.

**Integration constraints to keep the POC model open to this (no M8 work now):**
- Session identity must be addressable from outside the original tab/visit — keyed by visitor/checkout identity, not only a client cookie — so an email or dashboard link can resolve the right session to resume.
- `outcome` and finalization must not be treated as terminal/immutable; a finalized `abandoned` session can later transition (e.g. to `advanced`/`completed`) on resume.
- The resume window X is a configurable rule (see below), expected to be large in production.

### Configurable rules (resume)
- **Resume window `X`:** current default `30000ms` (normal) / `2000ms` (autotest). Exists so a brief leave/return is one session. Expected to be much larger in production (days/weeks, or even indefinite). **Indefinite X workaround:** set X to a very large value (e.g. ~100 years) — the session never expires by timeout alone. **Open tension (flagged 2026-05-26):** with indefinite X, the idle timeout no longer separates sessions naturally; a separate session-separation trigger will be needed (e.g. explicit "start new checkout" action or logout). Design deferred to M8.
- **Finalize/abandon timing:** in the POC this equals X; in production it is a **separate, shorter** window so abandonment (and the drop-off email) can fire while the session stays reopenable. Built in M8.

## M5 integration-ready state

M5 introduces a login step that creates visitor identity. Integration-facing changes:

### Visitor identity and attribution

- **Visitor ID:** at login completion, a unique visitor ID is generated. This is NOT derived from the entered login name (cosmetic only in the POC). The visitor ID is the stable attribution key. A new ID is minted at every login completion — no reuse of a prior stored value.
- **Session attribution:** all sessions from login onwards (personal-info, delivery, pay) are tagged with the visitor ID. This enables per-visitor analysis, cross-session attribution, and filtering in reporting (M7) and the admin dashboard (M6).
- **POC storage:** the visitor ID is stored in localStorage. This survives tab close, which is required so resume-within-X retains attribution when the visitor briefly leaves and returns on the same device.
- **localStorage is a POC stand-in only:** localStorage is per-device and per-browser — it cannot follow a visitor from desktop to mobile. In the real product (Autohero), visitor identity is resolved server-side from the authenticated account, making it cross-device. The POC design keeps the source of the visitor ID swappable: POC mints it locally; the real product injects the server-resolved identity. The downstream plumbing (tagging sessions with the ID) is identical in both cases.
- **Credentials in POC vs real product:** in the POC, credentials are not validated — the login step is a placeholder UI. In the real product (Autohero), the host performs real authentication and the visitor ID maps to a real user identity. The attribution plumbing (visitor ID on sessions) must be integration-ready for this.
- **Integration contract (M8):** the host product (Autohero) will need to supply the authenticated visitor identity after real login so the capture library stores the correct visitor ID. The exact handshake (JS callback, cookie, or redirect signal) is an M8 integration contract.
- **Login step capture:** not tracked in the POC. Built as a real step in the flow so heatmap capture can be added cheaply at Autohero integration — same "cheap to add later" pattern as the thank-you page.
- **visitor_id API exposure:** `visitor_id` is stored in the `sessions` DB table but NOT exposed via the query API in M5. Per-visitor outlier analysis in the POC is done via direct DB query. API exposure is deferred; when added it must be access-controlled (M6 auth gate).

### Session resume with visitor identity (M5 update)

- Resume-within-X applies to logged-in visitors. Login does not break resume — if a logged-in visitor leaves Personal Info and returns within X, the same session resumes with visitor attribution intact.
- POC supports basic returns only (reload/reopen tab). Real product supports multiple external return paths — drop-off email link, "my orders" screen, and other host-defined paths (see "Session resume and external re-entry" above).

## Milestone maintenance rule

At the end of each milestone, this document must be reviewed and updated to reflect:
- new integration-facing data models
- changed API contracts
- changed configurable rules
- newly stable or newly temporary boundaries
- anything removed, deprecated, or made milestone-specific
