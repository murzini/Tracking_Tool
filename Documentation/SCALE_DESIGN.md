# Scale Design — Batching, Ingestion, and Sampling

**Status: design-only (M3 Part 5).** This document is the M3 deliverable that designs how event capture scales to the target deployment (Autohero, thousands of visitors/day). **No code in this document is built in M3.** The batched ingestion pipe and the sampling/config gate are implemented in **M4**, alongside the rich events they serve (mouse-move, scroll, field focus/blur/change, visibility). M3's only write path is the existing click capture pointed at Postgres.

The purpose is to make the scale decisions explicit now so the M3 schema and storage choices do not have to be retrofitted later.

---

## 1. Volume target and constraints

- **Target:** Autohero-scale checkout traffic — thousands of visitors per day. POC volume today is ~1k/day (~30k/month).
- **Storage budget:** Neon free tier, 0.5 GB. TTL/archival cleanup already exists (`cleanupCheckoutHeatmapSessions` + `POST /api/checkout-heatmap/cleanup`, default 30-day retention) to stay under the limit.
- **Event mix at full capture (M4):** clicks are low-frequency; **mouse movement** is the high-frequency driver and dominates event volume. Scroll, field, and visibility events sit in between.
- **Design principle:** writes must scale with *visitors*, not with *events*. A single visit must cost a bounded, small number of round-trips regardless of how many raw events it produced.

---

## 2. Current write path (what M3 ships)

Honest baseline — this is correct for the POC but knowingly non-scalable:

- The capture client buffers a session in the browser and sends it **once, on finalization**, via `POST /api/checkout-heatmap` (one HTTP request per session — already not per-event).
- Server-side, `appendCheckoutHeatmapSession` inserts the session row, then inserts **one row per event in a sequential loop** over the Neon serverless HTTP driver. So a finalized session costs `1 + N` round-trips for `N` events.
- Only `type:"click"` events exist today, so `N` is small and the loop is acceptable.

Why this breaks at scale: once M4 adds mouse-move and other high-frequency events, `N` per session can reach hundreds or thousands. The per-event round-trip loop turns each visit into a burst of DB calls, and finalization-only delivery means a visitor who never finalizes (hard close) loses their data.

Tracked as tech debt in `PRODUCT_OVERVIEW.md` → Tech Debt → "Unbatched write-per-event" and "Indexes / pooling validated only at POC volume".

---

## 3. Target architecture (built in M4)

### 3.1 Client-side batching

- **In-memory ring buffer** of events on the capture client. Events are appended as they occur, never sent one-by-one.
- **Flush triggers (whichever comes first):**
  - buffer size threshold (e.g. ~50 events),
  - time interval (e.g. every ~5 s),
  - `visibilitychange → hidden` and `pagehide` (the critical one — captures the visitor who closes/navigates without an idle finalization).
- **Transport:** `navigator.sendBeacon()` for the unload-time flush (survives page teardown, fire-and-forget); `fetch(..., { keepalive: true })` for interval flushes. Payload is a compact batch: `{ sessionId, step, view, viewport, samplingRate, events: [...] }`.
- **Idempotency:** every event already carries a client-generated `id`. Re-delivery (beacon + interval overlap, retries) is safe because the server upserts with `ON CONFLICT (id) DO NOTHING` — already true for the events table today.
- **Session lifecycle decouples from delivery:** the session row is created/updated independently of event batches; events stream in across multiple batches and attach by `session_id`. `outcome` is set when the exit reason is known (idle / navigated / closed).

### 3.2 Server-side ingestion

- **Dedicated batch ingest endpoint** (e.g. `POST /api/checkout-heatmap/ingest`) that accepts a batch and writes it in **one round-trip per batch**, not per event:
  - **Multi-row parameterized INSERT** (`INSERT ... VALUES (...),(...),... ON CONFLICT (id) DO NOTHING`) for moderate batches. This is the primary mechanism and is enough for the POC-to-Autohero range.
  - **`COPY`** as the escalation path if a single batch ever carries thousands of rows (bulk-load fast path).
- **Connection pooling:** use Neon's pooled connection string for the ingest path so concurrent visitors do not exhaust connections. The serverless HTTP driver (`@neondatabase/serverless`) is already pool-friendly; the pooled endpoint is selected by connection string, no code change to `db.js`'s `getSql()` shape.
- **Write-optimized schema (already in place from M3):** indexes on `events(session_id)`, `events(type)`, `events(timestamp DESC)`, `events(session_id, type)`, and on `sessions(step)`, `sessions(view)`, `sessions(started_at DESC)`, `(step, view)`. These are designed for the Autohero volume; M3 exercises them only at POC volume.
- **Backpressure / durability (only if needed at real scale):** a managed queue (e.g. Vercel Queue / SQS-style) between the ingest endpoint and the DB can absorb spikes and decouple capture latency from write latency. Deferred until measured volume justifies it — the multi-row INSERT path is the default.

### 3.3 Read path at scale

- M3 queries raw rows on demand with the indexes above; **pre-aggregation is deferred** until a query proves slow (decision logged 2026-05-21 in `PRODUCT_OVERVIEW.md`).
- When needed, add rollup tables / materialised views (per step × view × day) for the funnel/heatmap aggregates. Mouse-move is the most likely first candidate for light pre-aggregation (grid-bucketing) because raw mouse-move rows are the largest table.
- Query API has no pagination/limits yet (tracked debt) — add cursor pagination before exposing broad-timeframe queries to real volume.

---

## 4. Sampling

M3 stores the `sampling_rate` field only. The **mechanism is built in M4**. Three layers:

### 4.1 Visitor-level (internal) sampling
- A config rate (e.g. capture X% of visitors) drives a **per-visit decision persisted in a cookie**. The capture client reads the cookie; if the visit is not sampled, capture is fully gated off (no events, no session).
- **M4 default (decided 2026-05-22) = 100%** (track every visitor) — best for the POC. The cookie mechanism is still built so it can be exercised; the rate lives in code/env config (the dashboard control is M6).
- This is the enforcement point for future **usage-based pricing / monetization** (product-vision note; packaging logic is far-future, post-POC).

### 4.2 Event-level sampling (high-frequency events)
- High-frequency events — primarily **mouse movement** — are **throttled** (time-based) and/or **event-sampled** at capture time, gated by an enable/disable config flag per event type.
- **M4 default (decided 2026-05-22, "Option A"):** throttle mouse movement to **~1 sample / 100 ms (≈10 Hz)** and capture **100% of sampled visitors** (no additional event-level downsampling on top). Chosen for good path fidelity at modest volume for the POC; tunable later if storage or fidelity needs change.
- Clicks and field events are never down-sampled (low frequency, high signal).

### 4.3 Effective sampling rate and count scaling
- Each session stores an **effective `samplingRate` = external % × internal %**.
  - *External %* = the share of host traffic that reaches our tool. The tool works normally on whatever it receives; we only record the rate. The signalling/limiting mechanism is an **M8** integration contract.
  - *Internal %* = our own visitor-level rate (4.1).
- **Report-time use:** drop-off *ratios* need no adjustment (numerator and denominator are sampled equally). Absolute *counts* are scaled up by dividing by `samplingRate`. Reporting (M7) reads this field; M3/M4 only store it correctly.

---

## 5. Milestone boundaries (where each piece lands)

| Concern | M3 (now) | M4 | M6 | M8 |
|---|---|---|---|---|
| Schema can hold all events + `outcome` + `samplingRate` | ✅ done | — | — | — |
| Indexes + pooling designed | ✅ done (exercised at POC volume) | validated at higher volume | — | — |
| TTL / archival cleanup | ✅ done | — | — | — |
| Client batching (buffer + beacon/keepalive flush) | designed here | ✅ build | — | — |
| Batch ingest endpoint (multi-row INSERT / COPY) | designed here | ✅ build | — | — |
| Capture rich events (mouse-move, scroll, field, visibility) | — | ✅ build | — | — |
| Visitor-level + event-level sampling mechanism | field only | ✅ build | — | — |
| Enable/disable per event type, traffic %, steps, timeframe (config UI) | — | flag honored | ✅ dashboard | — |
| External traffic-limiting contract + record external rate | field only | — | — | ✅ contract |
| Pre-aggregation / rollups | deferred (raw queries) | only if a query proves slow | — | at real scale |

---

## 6. Open risks to validate in M4

- **Mouse-move volume** is unverified end-to-end — the throttle/sample rate vs. heatmap fidelity trade-off needs tuning against real captures.
- **Indexes and pooling** are designed for millions of rows but only exercised at ~1k/day in M3; revalidate under M4's richer event stream.
- **Beacon payload size limits** (~64 KB per `sendBeacon`) cap how many events one unload flush can carry — the interval flush must keep the buffer small enough that the final flush fits.
- **Query-API payload size** (no pagination yet) — a broad-timeframe query over fully-captured sessions can be large; pagination must land before that path sees real volume.
