# Data

This document describes the data storage approach and the canonical schema for all heatmap data. It evolves with each milestone as the schema and storage layer change.

> **Current store: Neon Postgres** (since M3). The schema below is the live one. The original M1–M2 local-JSON store is superseded — its schema is kept as a clearly-labelled [historical appendix](#appendix--m1-local-json-store-historical) at the end.

---

## Storage approach

The store is **Neon (serverless Postgres)** — two tables, `sessions` + `events`, accessed through `lib/prototype/checkoutHeatmapStore.server.js`. The API contract (`GET / POST / DELETE /api/checkout-heatmap`, plus the `ingest` / `query` / `cleanup` / `sweep` routes added in M3/M4) is stable; only the store implementation changed when M3 moved off the JSON file.

Dev and test run locally against Neon via the pooled connection string; the Vercel deploy itself is deferred to M8. This remains a throwaway POC store — data is cleared frequently during development via `DELETE /api/checkout-heatmap`.

**History:** M1–M2 persisted to a local JSON file at `.m1-data/checkout-heatmap-sessions.json` (atomic `.tmp`-rename writes). M3 replaced it with Postgres behind the same API contract. The JSON-store details are in the [appendix](#appendix--m1-local-json-store-historical).

---

## Schema — Postgres (Neon)

Two tables. A click is an event of `type: "click"` — the original M1 `clicks[]` array was generalised to `events[]` in M3.

### sessions

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `m1_hm_session_<uuid>` |
| `version` | INTEGER | schema version, default 1 |
| `step` | TEXT | `personal-info` \| `delivery` \| `pay` |
| `sku` | TEXT | nullable |
| `view` | TEXT | `desktop_view` \| `mobile_view` |
| `viewport_width` | INTEGER | |
| `viewport_height` | INTEGER | |
| `started_at` | TIMESTAMPTZ | |
| `last_interaction_at` | TIMESTAMPTZ | nullable |
| `finalized_at` | TIMESTAMPTZ | nullable |
| `coordinate_scope` | TEXT | |
| `inactivity_ms` | INTEGER | |
| `duration_ms` | INTEGER | |
| `click_count` | INTEGER | default 0 |
| `interaction_count` | INTEGER | default 0 |
| `outcome` | TEXT | `abandoned` (visitor dropped off — did not complete the step) \| `completed` \| `advanced` — written M4. `in-progress` (started, not yet resolved) — written M4 Part 6; replaces `null` for committed-but-unfinalized sessions. A terminal outcome (advanced/completed/abandoned) is never overwritten by a later `in-progress` flush. |
| `exit_reason` | TEXT | how the visitor left a non-completed step: `idle` \| `nav-click` \| `back` \| `left-browser` — added M4 Part 5. **`in-progress` + `exit_reason` can co-exist, and this is intentional (decided 2026-05-24):** the exit beacon records *how* the visitor left while the session stays `in-progress` because they may return within X. If X elapses with no return, the sweep finalizes it (`abandoned`) keeping this `exit_reason`. So `in-progress` + `left-browser` reads as "visitor left the page; not yet finalized; may still return within X." |
| `sampling_rate` | NUMERIC | effective rate (external × internal %) — written M4 |
| `step_active_ms` | INTEGER | active time on step — written M4 |
| `step_idle_ms` | INTEGER | idle time on step — written M4 |
| `visitor_id` | TEXT | UUID minted on login Continue, stored in localStorage; links all sessions from the same visitor across steps — written M5 |
| `created_at` | TIMESTAMPTZ | default NOW() |

Indexes: `step`, `view`, `started_at DESC`, `(step, view)`, `created_at DESC`, `outcome` (partial, WHERE NOT NULL).

### events

Generalises `clicks[]` → `events[]`. A click is `type: "click"`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `m1_hm_click_<uuid>` |
| `session_id` | TEXT FK | → sessions.id ON DELETE CASCADE |
| `type` | TEXT | `click` \| `tap` \| `mouse-move` \| `scroll` \| `field-focus` \| `field-blur` \| `field-change` \| `validation-error` \| `element-visible` \| `element-hidden` \| … |
| `timestamp` | TIMESTAMPTZ | |
| `detail` | JSONB | type-specific payload. **click/tap:** `anchor`, `target`, `uiState`, `x`, `y` — the canonical click shape is documented in the [appendix Click schema](#click-schema-m1-store-shape) (still current as the click/tap `detail` payload). **`mouse-move`** (M4 Part 3 desktop; Part 7 mobile finger-movement via `touchmove`): surface-relative `x`, `y`. **`scroll`** (M4 Part 3): `depth` (0–100% of page) + `scrollY` (px). **field events** (M4 Part 4) `field-focus`/`field-blur`/`field-change`: `anchor` (field id) + a filled/empty indicator (value-present flag and/or length) — **never the raw typed value** (Autohero captures values at its own layer; we capture only completed-vs-empty). **`validation-error`** (M4 Part 4): the error `anchor` + the field it belongs to (distinct from a click on the error). **`element-visible`/`element-hidden`** (M4 Part 4): the element `anchor` + timestamps; per-element visible **duration** is derived by pairing visible→hidden across the session (drives "most-seen areas" — visualised in M6/M7). |
| `created_at` | TIMESTAMPTZ | default NOW() |

Indexes: `session_id`, `type`, `timestamp DESC`, `(session_id, type)`.

### Test isolation

Tests run against the `heatmap_test` Postgres schema (same Neon DB). The playwright runner sets `HEATMAP_DB_SCHEMA=heatmap_test`; `lib/prototype/db.js` reads this env var (default: `public`). A post-suite teardown truncates the `heatmap_test` schema so test data never persists between runs.

---

## Schema evolution

| Milestone | Change |
|-----------|--------|
| M1 | Initial schema. `step` always `"personal-info"`. Local JSON file store. |
| M2 (Part 1) | Scanner replaces the manual registry. Anchor IDs are now `type:label-slug` (e.g. `text:name`, `display:city`); `anchor.type` added; new `display` and `error` anchor types captured. |
| M2 (Part 2) | `step` becomes variable: `"personal-info"`, `"delivery"`, `"pay"`. |
| M3 (Part 1) | Local JSON store replaced with Neon Postgres. `sessions` + `events` tables (generalises `clicks[]` → `events[]`). Added `outcome`, `sampling_rate`, `step_active_ms`, `step_idle_ms` columns (scaffolding; written in M4). Test-DB isolation via `heatmap_test` schema. |
| M4 (Part 3) | First non-click event rows written: `mouse-move` (desktop, ~100 ms throttle; `detail` = surface-relative `x`/`y`) and `scroll` (`detail` = `depth` 0–100 + `scrollY`). No schema change — both ride the existing `events.type` + JSONB `detail` columns. Events become polymorphic in code (per-`type` normalization); the click heatmap is unaffected (aggregation still filters click/tap). |
| M4 (Part 4) | Field / validation / visibility event rows written: `field-focus` / `field-blur` / `field-change` (`detail` = light `anchor` + `filled` flag + `length`; **never the raw value**), `validation-error` (`detail` = the `error`-type `anchor`), and `element-visible` / `element-hidden` (`detail` = light `anchor`; `element-hidden` adds `visibleMs`). No schema change — all ride `events.type` + JSONB `detail`. |
| M4 (Part 5) | Session-level signals now written: `exit_reason` (new TEXT column — `idle` / `nav-click` / `back` / `left-browser`; only on a non-completed/abandoned step) and `step_active_ms` / `step_idle_ms` (existing columns, now populated; `active + idle = duration`). `outcome` now takes `advanced` / `completed` on step navigation (not only `abandoned`). Lazy/derived finalize: a closed-tab drop-off is finalized by `POST /api/checkout-heatmap/sweep` (no always-on runtime). Zero-interaction visits are now committed on the exit beacon and finalized as `abandoned` bounces. |
| M4 (Part 6) | `outcome` gains `in-progress`: a committed-but-unfinalized session is stamped `in-progress` (server-side in the ingest upsert) instead of `null`. The sweep now matches `outcome IS NULL OR 'in-progress'`, and the ingest upsert guards `outcome` with a CASE so a terminal outcome is never reverted by a late `in-progress` flush. No schema change. (Rendering-only changes — mouse-move/scroll views + toggle — touch no tables.) |
| M4 (Part 7) | Mobile finger-movement captured as `mouse-move` rows (`touchmove`, ~10 Hz throttle, surface-relative `x`/`y`). No schema change — reuses the `mouse-move` type. |
| M4 (Part 8) | Rendering-only port (chosen single style per type); touches no tables or columns. |

---

## Appendix — M1 local JSON store (historical)

> **Superseded by Postgres in M3** (see [Storage approach](#storage-approach)). Retained for historical context. The JSON *store* (file + envelope) is gone, but the **click/tap `detail` payload** in the Postgres `events` table still follows the Click schema shape below (`anchor` / `target` / `uiState` / `x` / `y`), so that table remains the canonical reference for click detail.

### Storage (M1) — local JSON file

Sessions were persisted to a local JSON file at `.m1-data/checkout-heatmap-sessions.json` (gitignored), surviving server restarts. All reads/writes went through `lib/prototype/checkoutHeatmapStore.server.js` with atomic `.tmp`-rename writes to prevent corruption. A throwaway store, cleared frequently during development; never intended for production.

### Session schema (M1)

A session represents one visitor's drop-off event on a single checkout step.

```json
{
  "id": "m1_hm_session_<uuid>",
  "version": 1,
  "step": "personal-info",
  "sku": "001",
  "view": "desktop_view",
  "viewport": {
    "width": 1280,
    "height": 800
  },
  "startedAt": "2026-05-20T10:00:00.000Z",
  "lastInteractionAt": "2026-05-20T10:00:42.000Z",
  "finalizedAt": "2026-05-20T10:01:12.000Z",
  "coordinateScope": "shop-content-v4",
  "inactivityMs": 30000,
  "durationMs": 72000,
  "clickCount": 3,
  "interactionCount": 7,
  "clicks": [ ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique session ID, prefixed `m1_hm_session_` |
| `version` | number | Schema version — currently `1` |
| `step` | string | Checkout step — one of `"personal-info"`, `"delivery"`, `"pay"` (variable since M2 Part 2) |
| `sku` | string \| null | Backpack SKU the visitor was viewing |
| `view` | string | `"desktop_view"` or `"mobile_view"` based on viewport width vs 1024px breakpoint |
| `viewport.width` | number | Viewport width in px at session start |
| `viewport.height` | number | Viewport height in px at session start |
| `startedAt` | ISO string | When the session began |
| `lastInteractionAt` | ISO string | Timestamp of the last recorded interaction |
| `finalizedAt` | ISO string \| null | When the session was finalized; null if still active |
| `coordinateScope` | string | Coordinate reference frame — `"shop-content-v4"` |
| `inactivityMs` | number | Inactivity threshold used to finalize this session (ms) |
| `durationMs` | number | Total session duration from start to finalization (ms) |
| `clickCount` | number | Number of clicks in `clicks[]` |
| `interactionCount` | number | Total interactions recorded (clicks + mouse-move + scroll + focus + key + change) |
| `clicks` | array | Ordered list of click events — see Click schema below |

### Click schema (M1 store shape)

Each entry in `session.clicks[]` represented one click or tap. **This shape is still current** as the `detail` payload of a click/tap row in the Postgres `events` table.

```json
{
  "id": "m1_hm_click_<uuid>",
  "type": "click",
  "x": 320,
  "y": 450,
  "coordinateScope": "shop-content-v4",
  "timestamp": "2026-05-20T10:00:15.000Z",
  "anchor": {
    "id": "text:name",
    "type": "text",
    "dx": 0,
    "dy": 0
  },
  "target": {
    "tagName": "input",
    "role": null,
    "label": "Name",
    "name": "name",
    "offsetX": 12.5,
    "offsetY": 8.0
  },
  "uiState": {
    "validationVisible": false,
    "validationYShift": 0,
    "openAccordions": []
  },
  "debug": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique click ID, prefixed `m1_hm_click_` |
| `type` | string | `"click"` (mouse/touchpad) or `"tap"` (touch) |
| `x` | number | X coordinate relative to `coordinateScope` surface |
| `y` | number | Y coordinate relative to `coordinateScope` surface |
| `coordinateScope` | string | Coordinate reference frame — matches session |
| `timestamp` | ISO string | When the click occurred |
| `anchor.id` | string | Stable id of the nearest tracked element, in `type:label-slug` form (M2 scanner; e.g. `text:name`, `display:city`). M1 data used the raw `data-heatmap-id` attribute value. |
| `anchor.type` | string | Scanner-resolved element type (M2; e.g. `text`, `toggle`, `display`, `error`). Optional — absent on legacy M1 clicks. |
| `anchor.dx` | number | Horizontal offset from anchor element center (px) |
| `anchor.dy` | number | Vertical offset from anchor element center (px) |
| `target.tagName` | string \| null | HTML tag of the clicked element |
| `target.role` | string \| null | ARIA role of the clicked element |
| `target.label` | string \| null | Visible label or accessible name |
| `target.name` | string \| null | `name` attribute if present |
| `target.offsetX/Y` | number | Click offset within the target element |
| `uiState.validationVisible` | boolean | Whether validation errors were visible at click time |
| `uiState.validationYShift` | number | Vertical shift caused by validation errors (px) |
| `uiState.openAccordions` | string[] | Which accordions were open at click time |
| `debug` | object \| null | Raw coordinate diagnostics — for development only |

### Store file format (M1)

The `.m1-data/checkout-heatmap-sessions.json` file wrapped sessions in an envelope:

```json
{
  "version": 1,
  "updatedAt": "2026-05-20T10:05:00.000Z",
  "sessions": [ ]
}
```
