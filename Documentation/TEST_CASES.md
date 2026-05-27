# Test Cases

This document contains the full specification for all automated test cases across milestones. Test cases are reviewed and updated at the start of each new milestone — some are kept as-is, some updated, some retired, and new ones added. See `PRODUCT_OVERVIEW.md` for the review rules.

---

## M1 — Personal Information Heatmap

**Suite:** 11 test cases across 3 spec files
**Framework:** Playwright, running against `localhost:3000`
**Visitor flow rule:** All behavioral tests must navigate via the full visitor path — landing → "Shop backpacks" → search → click product → details → "Add to cart" → personal info. Direct URL navigation is only permitted for structural checks (Test 11).
**Test-mode inactivity:** Tests that require drop-off detection use `m1HeatmapTest=1` query param to activate the 2-second inactivity threshold.

---

### `tests/e2e/m1-heatmap.spec.ts` — Tests 1–6, 10

**Test 1 — Drop-off storage rules**
Verify that only sessions with at least one interaction and 2s inactivity are stored.
- Scenario A: clear data → navigate via full visitor flow → no interactions → wait 2s → `GET /api/checkout-heatmap` must return 0 sessions → screenshot heatmap (empty state)
- Scenario B: clear data → navigate via full visitor flow → click Name field → wait 2s → `GET /api/checkout-heatmap` must return 1 session with ≥1 click → screenshot heatmap
- Evidence: `test-results/Test 1 - Drop-off storage rules/Check evidence/`

**Test 2 — Clear data removes stored history**
Verify that Clear data removes all stored sessions.
- Clear data → navigate via full visitor flow → click Name field → wait 2s → `GET /api/checkout-heatmap` must return 1 session (pre-condition)
- Open heatmap page → screenshot (before clear)
- Click **Clear data** button in the header
- Reload heatmap page → heatmap stats must show "0 sessions" → screenshot (after clear)
- `GET /api/checkout-heatmap` must return 0 sessions
- Evidence: `test-results/Test 2 - Clear data removes history/Check evidence/`

**Test 3 — Heatmap button opens heatmap in a new tab**
Verify that the Heatmap button in the header opens the heatmap in a new tab without affecting the checkout tab.
- Navigate via full visitor flow to the checkout page
- Click the **Heatmap** button in the header
- A new browser tab must open with URL containing `/heatmap`
- The original tab must remain open with a URL containing `/checkout`
- Evidence: screenshot of original checkout tab and screenshot of new heatmap tab → `test-results/Test 3 - Heatmap opens in new tab/Check evidence/`

**Test 4 — Mobile layout at 430 × 932**
Verify the personal-info checkout step renders a mobile-friendly layout at iPhone 14 Pro Max dimensions.
- The viewport is fixed at 430 × 932 (iPhone 14 Pro Max) — regression test for a specific documented breakpoint
- Set viewport to 430 × 932 → navigate via full visitor flow to the checkout page
- All three step pills ("Personal Information", "Choose Delivery", "Pay & Finish") must be visible and their bounding boxes must fit fully within the 430px viewport width
- No horizontal page overflow (`document.scrollWidth <= window.innerWidth`)
- Name and Birthdate fields must stack vertically — Birthdate must be below Name (single-column layout)
- Evidence: screenshot → `test-results/Test 4 - Mobile layout iPhone 14 Pro Max/Check evidence/`

**Test 5 — View separation**
Verify sessions are separated by rendered layout into `desktop_view` and `mobile_view`.
- Clear data → set viewport to 1280×800 → navigate via full visitor flow → click Name field → wait 2s → session finalized and tagged `desktop_view`
- Set viewport to 430×932 → navigate via full visitor flow → click Name field → wait 2s → session finalized and tagged `mobile_view`
- `GET /api/checkout-heatmap` must return 2 sessions: exactly 1 with `view=desktop_view` and 1 with `view=mobile_view`
- Open heatmap at `?view=desktop_view` → stats must show "1 sessions" → screenshot
- Open heatmap at `?view=mobile_view` → stats must show "1 sessions" → screenshot
- Evidence: `test-results/Test 5 - View separation/Check evidence/`

**Test 6 — Cross-backpack aggregation**
Verify sessions across different backpack SKUs aggregate into the same heatmap.
- Clear data → set viewport to 1280×800
- Navigate via full visitor flow to SKU 001 → click Name field → wait 2s → session finalized
- Navigate via full visitor flow to SKU 002 → click Name field → wait 2s → session finalized
- `GET /api/checkout-heatmap` must return 2 sessions with SKUs containing both 001 and 002
- Open heatmap at `/checkout/001/heatmap?view=desktop_view` → stats must show "2 sessions"
- Evidence: screenshot → `test-results/Test 6 - Cross-backpack aggregation/Check evidence/`

**Test 10 — Radius scaling (desktop + mobile)**
Verify that repeated clicks on the same element produce a proportionally larger dot.
- Same scenario run at both viewports
- Desktop (1280×800): clear data → navigate via full visitor flow with `m1HeatmapTest=1` → click Name input 3 times (100ms apart) → click ZIP input once → wait 2s → flush session → open heatmap at `?view=desktop_view` → assert dot "3 clicks" width ≈ 48px (max radius 24px × 2) → assert dot "1 click" width ≈ 16px (proportional: 24 × 1/3 × 2) → assert 3-click dot wider than 1-click dot → full-page screenshot
- Mobile (430×932): same scenario → open heatmap at `?view=mobile_view` → same assertions
- Note: session is flushed explicitly rather than waiting for inactivity, since multiple clicks keep resetting the inactivity timer
- Evidence: `test-results/Test 10 - Radius scaling/Check evidence/desktop/` and `.../mobile/`

---

### `tests/e2e/m1-heatmap-anchor.spec.ts` — Tests 7, 8, 9

These tests verify the element-anchor capture approach: each click is stored as an offset from the nearest named element and dots are placed relative to that element in the heatmap.

**Test 7 — On-element clicks snap to element center (desktop + mobile)**
- Same scenario at both viewports using 5 targets: Name input, ZIP input, Phone code dropdown, Waterproof cover checkbox, CTA button
- Desktop (1280×800): clear data → navigate via full visitor flow with `m1HeatmapTest=1` → for each target: scroll into view → click center → wait 2s → flush session → open heatmap at `?view=desktop_view` → for each target: find closest dot → assert distance from element center ≤ 5px → screenshots
- Mobile (430×932): same scenario → open heatmap at `?view=mobile_view` → same assertions
- Evidence: `test-results/Test - Element anchor precision/Check evidence/desktop/on-element/` and `.../mobile/on-element/`

**Test 8 — Free-space clicks land at correct offset (desktop)**
- Clear data → navigate via full visitor flow with `m1HeatmapTest=1`
- Scroll CTA into view → click 30px below the CTA button's bottom edge (free space)
- Wait 2s → flush session → open heatmap at `?view=desktop_view`
- Compute expected dot position: 30px below CTA bottom edge relative to surface
- Find closest dot → assert distance from expected position ≤ 10px
- Evidence: 3 screenshots at top/mid/bottom scroll positions → `test-results/Test - Element anchor precision/Check evidence/desktop/free-space/`

**Test 9 — Validation state does not displace dots (desktop + mobile)**
Core regression: validation errors shift layout but dots must still land on correct elements.
- Desktop (1280×800): clear data → navigate via full visitor flow with `m1HeatmapTest=1` → click CTA to trigger validation → wait 300ms for errors to render → click Name, ZIP, CTA again while validation is visible → wait 2s → flush session → open heatmap at `?view=desktop_view` → for each of 3 targets: find closest dot → assert distance from element center ≤ 5px → screenshots
- Mobile (430×932): same scenario → open heatmap at `?view=mobile_view` → same assertions
- Evidence: `test-results/Test - Element anchor precision/Check evidence/desktop/validation/` and `.../mobile/validation/`

---

### `tests/e2e/m1-heatmap-registry-sync.spec.ts` — Test 11

**Test 11 — Registry–DOM sync (all steps)**
Verify two-direction parity between the rendered DOM and the auto-maintained scanner snapshot, asserted independently for each checkout step.
- Read all entries with `removedAt: null` from `CHECKOUT_ELEMENT_REGISTRY` in `checkoutHeatmapRegistry.js`, including each entry's `steps` list
- For each step in `personal-info`, `delivery`, `pay`:
  - Navigate directly to `/checkout/001/heatmap?step=<step>` (structural integrity check — visitor flow rule does not apply)
  - Wait for the step's sentinel element to attach (`cta:choose-delivery` / `radio:delivery-novaposhta` / `radio:pay-card`)
  - Read all `data-heatmap-id` attribute values from the live DOM
  - Assert direction 1: every `data-heatmap-id` in the DOM has an active registry entry whose `steps` includes this step
  - Assert direction 2: every active registry entry whose `steps` includes this step has a corresponding `data-heatmap-id` in the DOM
- Scope: only tagged anchors are checked; untagged auto-discovered elements (plain inputs, tooltip close button, error messages) are out of scope
- No evidence screenshots (structural check, not visual)

---

## M2 — Full Checkout Coverage

**Suite:** 7 M1 tests updated for M2 (Tests 1, 3, 7, 8, 9, 10, 11) + 8 new cases (Tests 12–19). Numbering continues from M1 — no separate M2 numbering.
**Framework:** Playwright, running against `localhost:3000`
**Visitor flow rule:** Inherited from M1 — all behavioral tests navigate via the full visitor path (landing → "Shop backpacks" → search → click product → details → "Add to cart" → target step). Direct URL navigation only for structural checks.
**Test-mode inactivity:** Same as M1 — `m1HeatmapTest=1` activates the 2-second inactivity threshold.
**Steps in scope:** `personal-info`, `delivery`, `pay`

**Implementation status (Parts 1–5 — done; 24 tests green on `localhost:3000`):** Tests 7, 8, 9, 10, 11 migrated in place to the re-mapped `type:label` anchor IDs (`tests/e2e/m1-heatmap*.spec.ts`); Tests 13–16 added in `tests/e2e/m2-scanner-pi.spec.ts` (auto-discovery, `data-heatmap-type` hint, `display` capture, `error` capture). **Part 2:** Test 1 now asserts `step: "personal-info"` on the stored session, and Test 12 (step-field tagging, personal-info scenario) added in `m2-scanner-pi.spec.ts`. **Part 3:** the **delivery and pay scenarios of Test 12** and the **capture half of Test 18** (Delivery/Pay) are added in a new spec file `tests/e2e/m2-delivery-pay.spec.ts`; capture is enabled on all three steps and the delivery/pay options and CTAs are tagged (`radio:delivery-*`, `radio:pay-*`, `cta:pay-finish`, `cta:pay`). **Part 4:** Test 3 updated to assert the Heatmap **step dropdown** (`m1-heatmap.spec.ts`), the **render half of Test 18** (open `?step=delivery`/`?step=pay` → dot present) added in `m2-delivery-pay.spec.ts`, and **Test 19** (step-aware viewer) added in the new `tests/e2e/m2-viewer.spec.ts`. Because the prototype cannot advance checkout steps interactively (the step buttons drop the `step` param outside tour mode, and tour mode is a view-only overlay), these tests navigate the full visitor path to checkout and then switch to the target step via `?step=`. **Part 5:** **Test 17** (fixed-position precision — desktop order-summary sidebar + chatbot icon) added in the new `tests/e2e/m2-fixed-position.spec.ts`, and **Test 11** re-pointed at the step-aware `CHECKOUT_ELEMENT_REGISTRY` snapshot, asserting registry↔DOM parity per step across all three steps. The optional Part 4 hardening (step-dropdown dismiss, explicit Pay card+wire panel assertion, Personal Information dropdown end-to-end) was non-blocking and not implemented — carried forward.

Note: the M1 section above is the historical record and is unchanged. The M2-adjusted versions of M1 tests live here under "M1 tests updated for M2".

---

### New M2 cases (numbering continues from M1)

**Test 12 — Step-field tagging**
Verify that sessions are tagged with the checkout step at which clicks were recorded.
- Clear data → navigate via full visitor flow → reach personal-info step → click a tracked element → wait 2s → `GET /api/checkout-heatmap` must return 1 session with `step: "personal-info"` *(implemented in Part 2)*
- Clear data → navigate via full visitor flow → reach delivery step → click a tracked element → wait 2s → `GET /api/checkout-heatmap` must return 1 session with `step: "delivery"` *(implemented in Part 3)*
- Clear data → navigate via full visitor flow → reach pay step → click a tracked element → wait 2s → `GET /api/checkout-heatmap` must return 1 session with `step: "pay"` *(implemented in Part 3)*
- Evidence: `test-results/M2 Test 12 - Step-field tagging/Check evidence/`

**Test 13 — Scanner auto-discovery (untagged element)**
Verify the scanner captures a trackable element that has no manual `data-heatmap-id`.
- Clear data → full visitor flow with `m1HeatmapTest=1` to personal-info
- Open the birthdate tooltip → click its close (`X`) button (no `data-heatmap-id`)
- Wait 2s → flush → `GET /api/checkout-heatmap`
- Assert the click stored an auto-generated anchor for the close button, with no manual registry entry required
- Evidence: `test-results/M2 Test 13 - Scanner auto-discovery/Check evidence/`

**Test 14 — `data-heatmap-type` hint honored**
Verify a hinted element is classified by its declared type, not its structural tag.
- Clear data → full visitor flow with `m1HeatmapTest=1` to personal-info
- Click the **Private** account-type control (a `<button>` tagged `data-heatmap-type="toggle"`)
- Wait 2s → flush → `GET /api/checkout-heatmap`
- Assert the stored anchor type is `toggle` (e.g. `toggle:private`), not `button`
- Evidence: `test-results/M2 Test 14 - Hint honored/Check evidence/`

**Test 15 — `display` type capture**
Verify clicks on read-only value fields are captured as `display` anchors.
- Clear data → full visitor flow with `m1HeatmapTest=1` to personal-info
- Click the City field, then the Country field (read-only `<div>`s)
- Wait 2s → flush → `GET /api/checkout-heatmap`
- Assert anchors `display:city` and `display:country` are stored
- Evidence: `test-results/M2 Test 15 - Display capture/Check evidence/`

**Test 16 — `error` type capture**
Verify validation error messages are captured as `error` anchors.
- Clear data → full visitor flow with `m1HeatmapTest=1` to personal-info
- Click `cta:choose-delivery` to trigger validation → wait 300ms for errors to render
- Click a visible validation error message
- Wait 2s → flush → `GET /api/checkout-heatmap`
- Assert an `error`-type anchor is stored for the clicked error
- Evidence: `test-results/M2 Test 16 - Error capture/Check evidence/`

**Test 17 — Fixed-position element precision (desktop)**
Verify clicks on `position: fixed` elements land on the element after scrolling, not on empty space.
- Targets: `area:order-summary` (desktop sidebar) and `icon:chatbot`
- Clear data → full visitor flow with `m1HeatmapTest=1` to personal-info (desktop 1280×800)
- Scroll the page down so surface content has moved
- Click the order-summary sidebar → click the chatbot icon → wait 2s → flush
- Open heatmap `?step=personal-info&view=desktop_view`
- For each target: nearest dot ≤10px from element center, rendered in the fixed overlay (not displaced by scroll)
- Evidence: `test-results/M2 Test 17 - Fixed-position precision/Check evidence/`

**Test 18 — Delivery & Pay coverage**
Verify capture, drop-off, and rendering work on the delivery and pay steps.
*Status (Parts 3–4 — done):* the capture assertions (step-tagged session + correct anchor on delivery and pay) and the render assertions (`open ?step=… heatmap → dot present`) are both implemented in `tests/e2e/m2-delivery-pay.spec.ts`.
- Clear data → full visitor flow with `m1HeatmapTest=1` → reach delivery step → click a tracked element → wait 2s → 1 session `step: "delivery"` with correct anchor → open `?step=delivery` heatmap → dot present
- Clear data → full visitor flow → reach pay step → click a tracked element → wait 2s → 1 session `step: "pay"` with correct anchor → open `?step=pay` heatmap → dot present
- Evidence: `test-results/M2 Test 18 - Delivery and Pay coverage/Check evidence/`

**Test 19 — Step-aware viewer**
Verify the heatmap viewer renders the correct step via `?step=` and the view toggle works.
- Seed one drop-off session per step (personal-info, delivery, pay) via full visitor flow
- Open heatmap with `?step=personal-info` → only personal-info dots shown → screenshot
- Repeat for `?step=delivery` and `?step=pay` → each shows only its step's dots
- Toggle desktop/mobile within the viewer → view changes correctly
- Evidence: `test-results/M2 Test 19 - Step-aware viewer/Check evidence/`

---

### M1 tests updated for M2

These are the M2-adjusted versions of the M1 tests. The original M1 specifications remain unchanged in the M1 section above.

**Test 1 — Drop-off storage rules** *(updated)*
Verify only sessions with ≥1 interaction + 2s inactivity are stored, and the stored session carries the step.
- Scenario A: clear data → full visitor flow to personal-info → no interactions → wait 2s → `GET /api/checkout-heatmap` returns 0 sessions → screenshot (empty state)
- Scenario B: clear data → full visitor flow to personal-info → click a tracked element → wait 2s → `GET /api/checkout-heatmap` returns 1 session with ≥1 click and `step: "personal-info"` → screenshot
- Evidence: `test-results/M2 - Drop-off storage rules/Check evidence/`

**Test 3 — Heatmap step dropdown opens in new tab** *(updated)*
Verify the Heatmap button opens a step dropdown and the selected step's heatmap opens in a new tab.
- Navigate via full visitor flow to the checkout page
- Click the **Heatmap** button → a dropdown appears listing Personal Information, Choose Delivery, Pay & Finish
- Select a step → a new tab opens with URL containing `/heatmap?step=<step>`
- The original tab remains open with a URL containing `/checkout`
- Evidence: screenshots of the dropdown, original tab, and new heatmap tab → `test-results/M2 - Heatmap step dropdown/Check evidence/`

**Test 7 — On-element clicks snap to element center (desktop + mobile)** *(updated)*
Same precision scenario as M1, but targets are scanner-resolved with re-mapped IDs plus new types.
- Targets: `text:name`, `text:zip`, `dropdown:phone-code`, `checkbox:waterproof-cover`, `cta:choose-delivery`, `date:birthdate`, `display:city`
- Desktop (1280×800): clear data → full visitor flow with `m1HeatmapTest=1` → for each target: scroll into view → click center → wait 2s → flush → open heatmap `?step=personal-info&view=desktop_view` → nearest dot ≤5px from element center → screenshots
- Mobile (430×932): same scenario → `?view=mobile_view` → same assertions
- Evidence: `test-results/M2 - Element anchor precision/Check evidence/desktop/on-element/` and `.../mobile/on-element/`

**Test 8 — Free-space clicks land at correct offset (desktop)** *(updated)*
- Clear data → full visitor flow with `m1HeatmapTest=1` to personal-info
- Scroll CTA into view → click 30px below the `cta:choose-delivery` button's bottom edge (free space)
- Wait 2s → flush → open heatmap `?step=personal-info&view=desktop_view`
- Compute expected dot position 30px below CTA bottom edge → nearest dot ≤10px from expected
- Evidence: 3 screenshots at top/mid/bottom scroll → `test-results/M2 - Element anchor precision/Check evidence/desktop/free-space/`

**Test 9 — Validation state does not displace dots (desktop + mobile)** *(updated)*
- Desktop (1280×800): clear data → full visitor flow with `m1HeatmapTest=1` → click `cta:choose-delivery` to trigger validation → wait 300ms → click `text:name`, `text:zip`, `cta:choose-delivery` while errors visible → wait 2s → flush → open heatmap `?step=personal-info&view=desktop_view` → each of 3 targets: nearest dot ≤5px from center → screenshots
- Additionally assert a visible validation error is captured as an `error`-type anchor
- Mobile (430×932): same scenario → `?view=mobile_view` → same assertions
- Evidence: `test-results/M2 - Element anchor precision/Check evidence/desktop/validation/` and `.../mobile/validation/`

**Test 10 — Radius scaling (desktop + mobile)** *(updated)*
- Desktop (1280×800): clear data → full visitor flow with `m1HeatmapTest=1` → click `text:name` 3× (100ms apart) → click `text:zip` once → wait 2s → flush → open heatmap `?step=personal-info&view=desktop_view` → assert 3-click dot width ≈48px, 1-click ≈16px, 3-click wider than 1-click → screenshot
- Mobile (430×932): same scenario → `?view=mobile_view` → same assertions
- Evidence: `test-results/M2 - Radius scaling/Check evidence/desktop/` and `.../mobile/`

**Test 11 — Element register sync** *(updated)*
Verify two-way parity between discovered/tagged elements and the auto-maintained registry snapshot, across all steps.
- For each step (`personal-info`, `delivery`, `pay`): navigate directly to that step's heatmap (structural check — visitor flow rule does not apply)
- Run the scanner against the rendered step
- Read all `data-heatmap-id` values and scanner-discovered anchors from the live DOM
- Read all active entries (`removedAt: null`) from the auto-maintained registry snapshot
- Assert direction 1: every discovered/tagged element has a matching active snapshot entry
- Assert direction 2: every active snapshot entry is present in the DOM for that step
- No evidence screenshots (structural check)

---

## M3 — Data Completeness and Query Capability

**Status: COMPLETE (2026-05-22).** All five parts delivered; 32/32 tests green on the Postgres store. Produced by `milestone-test-planning` (logged `OK` 2026-05-22). Scope frozen 2026-05-21. Part 5 was design + close (no new test cases).
**Suite plan:** keep 11 as-is, update 8, remove 0, add 8 new (Tests 20–27). Numbering continues from M2.
**Framework:** Playwright, against `localhost:3000`, now backed by the Postgres (Neon) store.
**Visitor flow rule:** inherited from M1/M2 (full visitor path; direct URL only for structural checks).
**Test-mode inactivity:** inherited — `m1HeatmapTest=1` activates the 2-second threshold.
**Test-DB isolation (prerequisite, not a test case):** the suite runs against an isolated test database (`heatmap_test` schema in Neon) with clean teardown between runs. Controlled via `HEATMAP_DB_SCHEMA=heatmap_test` set before the dev server starts in `run-playwright-isolated.ps1`. **Resolved in Part 1.**
**Steps in scope:** `personal-info`, `delivery`, `pay`.

### Schema change affecting tests
`session.clicks[]` is generalised to `session.events[]`; each event carries a `type` (a click is `type:"click"`). The `GET /api/checkout-heatmap` response returns `events[]` (routes unchanged). Every test that reads `session.clicks` is updated to read `session.events` (filtered to `type:"click"` where a click is meant).

### New M3 cases (numbering continues from M2)

**Test 20 — Click stored as an event** ✅ *Implemented Part 3 (2026-05-22)*
- Clear data → full visitor flow → personal-info → click a tracked element → wait 2s → `GET /api/checkout-heatmap`
- Assert the stored session exposes `events[]` (not `clicks[]`), with one entry `type:"click"` carrying the correct anchor.
- Spec: `tests/e2e/m3-query-api.spec.ts`
- Evidence: `test-results/M3 Test 20 - Click as event/Check evidence/`

**Test 21 — `outcome` field present and correct** ✅ *Implemented Part 3 (2026-05-22)*
- Drop-off session via full visitor flow → wait 2s → `GET`
- Assert the session carries `outcome:"abandoned"`. (Completed/advanced outcomes are captured in M4; M3 records the field, defaulting drop-offs to `abandoned`.)
- Spec: `tests/e2e/m3-query-api.spec.ts`
- Evidence: `test-results/M3 Test 21 - Outcome field/Check evidence/`

**Test 22 — `samplingRate` field present** ✅ *Implemented Part 3 (2026-05-22)*
- Drop-off session → `GET` → assert `samplingRate` is present and numeric. (Mechanism is M4; M3 only stores the field.)
- Spec: `tests/e2e/m3-query-api.spec.ts`
- Evidence: `test-results/M3 Test 22 - Sampling rate field/Check evidence/`

**Test 23 — Query API: filter by step** ✅ *Implemented Part 3 (2026-05-22)*
- Seed drop-off sessions on more than one step → call `GET /api/checkout-heatmap/query?step=` → JSON returns only sessions for that step.
- Spec: `tests/e2e/m3-query-api.spec.ts`
- Evidence: `test-results/M3 Test 23 - Query by step/Check evidence/`

**Test 24 — Query API: filter by view** ✅ *Implemented Part 3 (2026-05-22)*
- Seed desktop + mobile sessions (mobile via 375px viewport) → query by `view` → only the matching view is returned.
- Spec: `tests/e2e/m3-query-api.spec.ts`
- Evidence: `test-results/M3 Test 24 - Query by view/Check evidence/`

**Test 25 — Query API: filter by timeframe** ✅ *Implemented Part 3 (2026-05-22)*
- Seed sessions → query with `from`/`to` window bracketing the session → returned; query with future `from` → empty.
- Spec: `tests/e2e/m3-query-api.spec.ts`
- Evidence: `test-results/M3 Test 25 - Query by timeframe/Check evidence/`

**Test 26 — Query API: combined filters** ✅ *Implemented Part 3 (2026-05-22)*
- Seed personal-info + delivery sessions → query with `step` + `view` + `from`/`to` together → only the matching session is returned.
- Spec: `tests/e2e/m3-query-api.spec.ts`
- Evidence: `test-results/M3 Test 26 - Query combined filters/Check evidence/`

**Test 27 — TTL / archival** ✅ *Implemented Part 4 (2026-05-22)*
- Seed session A → record cutoff → seed session B → POST `/api/checkout-heatmap/cleanup` with `{ before: cutoff }` → assert 1 deleted; only session B remains in both main store and query API.
- Note: cleanup uses `finalized_at < $1` (client-set timestamp) to avoid DB-vs-client clock skew.
- Spec: `tests/e2e/m3-query-api.spec.ts`
- Evidence: `test-results/M3 Test 27 - TTL archival/Check evidence/`

### M1/M2 tests updated for M3 (8) — **Done in Part 2 (2026-05-22); 24/24 green on Postgres**
Tests **1, 2, 12, 13, 14, 15, 16, 18**: assertions that read `session.clicks` now read `session.events` (a click is `type:"click"`); **Test 2** (Clear data) is additionally reconfirmed against the Postgres store (`DELETE` empties the database). The behavior each test asserts is otherwise unchanged.

### Kept as-is (11)
Tests **3, 4, 5, 6, 7, 8, 9, 10, 11, 17, 19** — assert on rendered dots / UI / structure, unaffected by the store swap and the `clicks[]`→`events[]` rename. They serve as regression coverage that moving to Postgres did not change behavior.

---

## M4 — Extended Interaction Capture

**Status: CLOSED (2026-05-26). Parts 1–8 done (Part 1 2026-05-22, Parts 2–4 2026-05-23, Parts 5–6 2026-05-24, Part 7 2026-05-24, Part 8 port 2026-05-25); suite 52/52 active tests passing (Tests 36 + 44 are `test.fixme`, deferred to M5). Both critical tech-debt items resolved. Remaining for close: close gates (`milestone-doc-review`, agent review, `milestone-prereqs`).** Plan produced by `milestone-test-planning` 2026-05-22 against the agreed M4 scope (`PRODUCT_OVERVIEW.md` → Future Milestones → M4) and the M4 architecture (`ARCHITECTURE_OVERVIEW.md`). Numbering continues from M3 (Tests 28+). **Test 28 (single-click step navigation) in `tests/e2e/m4-step-nav.spec.ts`, Tests 29–30 (batched ingest + sampling gate) in `tests/e2e/m4-ingest.spec.ts`, Tests 31–32 (mouse-move + scroll capture) in `tests/e2e/m4-mousemove-scroll.spec.ts`, Tests 33–35 (field/validation/visibility capture) in `tests/e2e/m4-field-visibility.spec.ts`, Tests 36–38 + 41 + 42 + 44 (session signals + outcomes; 36 + 44 are `test.fixme`) in `tests/e2e/m4-session-signals.spec.ts`, and Tests 39–40 + 43 (rendering) in `tests/e2e/m4-rendering.spec.ts` are implemented. Part 8 (2026-05-25) rewrote Tests 39, 40, 43 for the single-style views (the style toggle is gone) and hardened their session lookups against a stray funnel-bounce session; added Test 44 as `test.fixme` (session-merge regression guard, deferred to M5).**
**Framework:** Playwright, against `localhost:3000`, Neon Postgres store, isolated runner (`HEATMAP_DB_SCHEMA=heatmap_test`).
**Visitor flow rule / test-mode inactivity:** inherited from M1–M3.

### Scope changes that affect tests
- **Record all sessions, not just drop-offs** — zero-interaction visits are now recorded (bounce). This **invalidates the current "0 sessions when no interaction" assertion** (Test 1 Scenario A, `m1-heatmap.spec.ts:92`).
- **Batched transport** replaces the finalize-only POST — events are buffered and flushed (interval + `sendBeacon` on unload) to a new `ingest` endpoint. Read path (`GET /api/checkout-heatmap`) is unchanged.
- **Rich events** — sessions now hold mouse-move, scroll, field, validation, and visibility events alongside clicks. Assertions that read events must **filter by `type`** rather than assume a single/click-only event list.
- **New visualisations behind a toggle** — assumed to be separate views; the default heatmap stays click-dots, so click-precision tests are unaffected (verify this assumption holds in Part 6).
- **Interactive step navigation** now works (CTA advances steps), enabling real `advanced`/`completed` outcomes.

### Keep as-is (regression coverage — verify, don't change)
Tests **4, 5, 6, 11, 13, 14, 15, 16, 17, 19, 22, 23, 24, 25, 26, 27** — structural / UI / view-filtering / scanner / query-API / TTL behavior unaffected by M4. **Re-verify under batched transport** (persistence must be flushed before each `GET`); update only the shared flush/wait helper if timing changes, not the assertions.

### Update (existing tests that change)
- **Test 1 — Drop-off storage rules.** ✅ *Updated Part 5 (2026-05-24).* Scenario A changed: a no-interaction visit is now a **recorded zero-interaction bounce** (not 0 sessions). It asserts ≥1 bounce session, each `outcome:"abandoned"` with no interaction events (a forced sweep finalizes it). Scenario B unchanged (still ≥1 event, `step` tagged).
- **Test 20 — Click stored as an event.** Ensure it **filters `events` by `type:"click"`** (sessions now contain many event types) rather than asserting a single-element array. ✅ *Done in Part 4 (2026-05-23): Test 20 and Test 29 now find the click by `type` since the clicked field also emits field events on the same anchor.*
- **Tests 2, 12, 18** and any capture→read test — re-verify event delivery under the batched pipe; update the flush helper if needed. Assertions otherwise unchanged.
- **Test 7, 8, 9, 10** (click precision/radius) — keep, but confirm the new mouse-move/scroll renderings are a **separate toggled view** so "closest dot" still matches click dots; if not, scope the dot query to click-type.

### Remove
- None.

### New cases (Tests 28+)
- **Test 28 — Single-click step navigation.** ✅ *Implemented Part 1 (2026-05-22) — `tests/e2e/m4-step-nav.spec.ts`.* Fill mandatory fields → one CTA click advances personal-info → delivery → pay, one step per click, **no double-click**; the Pay CTA reaches the thank-you page. A second test asserts an invalid mandatory field blocks the advance and shows the validation error. (Part 1 acceptance requirement.)
- **Test 29 — Batched ingestion delivery.** ✅ *Implemented Part 2 (2026-05-23) — `tests/e2e/m4-ingest.spec.ts`.* Two functions: (a) clicks are delivered via batched `POST /ingest` (payload carries an `events[]` batch), the client makes **no** call to the legacy `POST /api/checkout-heatmap`, and the click lands in the store; (b) a click buffered then `pagehide`-flushed via `sendBeacon` lands in the store **without** finalize (polled inside the inactivity window). (Critical: delivery reliability.)
- **Test 30 — Sampling gate.** ✅ *Implemented Part 2 (2026-05-23); updated M6 to per-session (2026-05-27) — `tests/e2e/m4-ingest.spec.ts`.* Two functions: at 100% capture runs and the session stores `samplingRate:1`; with `heatmapSampleRate=0` no session/events are recorded. (Gate works both ways.) **M6:** sampling is now a **per-session** probability from the runtime config — the per-visitor `m1.heatmap.sampled` cookie was removed, so the cookie assertions were dropped. Only the deterministic 0%/100% gates are e2e-covered; intermediate-rate probability (e.g. 50%) is unit-test territory (M6.2).
- **Test 31 — Mouse-move + finger-move capture.** ✅ *Implemented Part 3 (2026-05-23); mobile half revised in Part 7 (2026-05-24) — `tests/e2e/m4-mousemove-scroll.spec.ts`.* Two functions: on desktop, moving the mouse records several `mouse-move` events whose consecutive timestamps are ≥~100 ms apart (throttled ≈10 Hz, not one-per-frame); on a mobile-width viewport, simulated `touchmove` finger drags record `mouse-move` events under the same ~100 ms throttle (finger movement is now captured on mobile — supersedes the original "movement = desktop-only" assertion), while the tap is still captured.
- **Test 43 — Mobile finger-movement render + disclaimer.** ✅ *Implemented Part 7 (2026-05-24); rewritten Part 8 (2026-05-25) — `tests/e2e/m4-rendering.spec.ts`.* A mobile session with finger movement (simulated `touchmove`, stored as `mouse-move`) renders in the "See mouse moves" view on the mobile heatmap, and the mobile view shows the finger-movement disclaimer; the desktop moves view shows none. **Part 8:** the moves view now renders **trails** (density dropped), so the test asserts the trails overlay draws a polyline; the disclaimer now lives in the top-bar moves note (`[data-heatmap-mobile-moves-disclaimer]`, mobile-only). Seed-session lookup hardened against a stray funnel bounce. (Capture itself is asserted by Test 31's mobile half.)
- **Test 32 — Scroll-depth capture.** ✅ *Implemented Part 3 (2026-05-23) — `tests/e2e/m4-mousemove-scroll.spec.ts`.* Scrolling down records `scroll` events carrying a 0–100 `depth`; depths are non-decreasing and the last is greater than the first (depth increases as the visitor scrolls down).
- **Test 33 — Field events.** ✅ *Implemented Part 4 (2026-05-23) — `tests/e2e/m4-field-visibility.spec.ts`.* Focus, edit, and blur a field → `field-focus` / `field-blur` recorded with the field anchor, and `field-change` recorded **on blur** (not per keystroke) when the value changed. Asserts the event carries a `filled` flag + `length` but **no raw typed value** key (no PII).
- **Test 34 — Validation-error-shown event.** ✅ *Implemented Part 4 (2026-05-23) — `tests/e2e/m4-field-visibility.spec.ts`.* Clicking the CTA with empty fields triggers validation → a `validation-error` event with an `error`-type anchor is recorded (distinct from a click on the error anchor).
- **Test 35 — Element visibility.** ✅ *Implemented Part 4 (2026-05-23) — `tests/e2e/m4-field-visibility.spec.ts`.* Scrolling tracked elements out of and back into view records `element-hidden` / `element-visible` (tracked for **all** scanned anchors, ≥50% = seen); element-hidden carries a `visibleMs` and at least one is > 0.
- **Test 36 — Zero-interaction bounce.** ✅ *Implemented Part 5 (2026-05-24); un-skipped M5 (2026-05-26) — `tests/e2e/m4-session-signals.spec.ts`.* Open a step and leave with no interaction (`pagehide`) → the exit beacon commits the bare session; a forced sweep finalizes it as `outcome:"abandoned"`. **M5 fix:** `hasClicks` gate removed from `saveSession` and `isCheckoutHeatmapDropOffCandidate` — any real activity (not just clicks) is sufficient to save a session. `.fixme` removed; test is active and green.
- **Test 37 — Outcome completed.** ✅ *Implemented Part 5 (2026-05-24) — `tests/e2e/m4-session-signals.spec.ts`. Updated M6 P1 (`advanced`→`completed`).* Fill personal-info and advance → the personal-info and delivery sessions are `completed`; finishing checkout from pay → the pay session is `completed`. A completed (success) session carries **no** exit reason.
- **Test 38 — Step timing.** ✅ *Implemented Part 5 (2026-05-24) — `tests/e2e/m4-session-signals.spec.ts`.* A finalized session records `step_active_ms` / `step_idle_ms`; both are present, non-negative, and reconcile exactly (`active + idle === duration`), with idle > 0 after a timeout.
- **Test 39 — Mouse-move rendering.** ✅ *Implemented Part 6 (2026-05-24); rewritten Part 8 (2026-05-25) — `tests/e2e/m4-rendering.spec.ts`.* **Part 8:** density is dropped — `See mouse moves` now renders **trails only** with no style toggle. The test asserts the trails overlay (`[data-heatmap-layer="mouse-moves"][data-heatmap-style="trails"]`) draws a polyline, that no `[data-heatmap-style-toggle]` exists, and that no density layer renders; the default (no `type` param) still stays on click dots. The seed-session lookup now finds the session carrying mouse-move events rather than asserting a single stored session (tolerates a stray funnel bounce). **Updated (manual-check fix, 2026-05-25):** the moves view now renders in the **capture-time layout** (validation off, accordions collapsed) so trails align with the elements. Test 39 asserts the clicks view forces the validation errors while the moves view shows **no** "Required field" — i.e. it renders the capture-time layout.
- **Test 40 — Scroll rendering.** ✅ *Implemented Part 6 (2026-05-24); rewritten Part 8 (2026-05-25) — `tests/e2e/m4-rendering.spec.ts`.* **Part 8:** the fold line is dropped — `See scrolls` now renders the **green colour-by-depth gradient only** with no style toggle. The test asserts the gradient overlay (`[data-heatmap-layer="scrolls"][data-heatmap-style="gradient"]`, `data-heatmap-has-data="true"`), the inline "<n>% saw it" legend (`[data-heatmap-scroll-legend]`), that no `[data-heatmap-style-toggle]` exists, and that no fold layer renders. Seed-session lookup hardened against a stray funnel bounce. **Updated (manual-check fix, 2026-05-25):** the scrolls view now renders in the **capture-time layout** (validation off, accordions collapsed). Test 40 asserts the scrolls render shows **no** "Required field" forced validation.
- **Test 42 — Stored `in-progress` outcome.** ✅ *Implemented Part 6 (2026-05-24) — `tests/e2e/m4-session-signals.spec.ts`. Updated M6 P1 (`advanced`→`completed`).* A started-but-unfinalized session reads `outcome:"in-progress"` (not null) and flips to `abandoned` after a sweep. A second case advances a step (→ `completed`) and confirms a later sweep does **not** overwrite the resolved outcome.
- **Test 41 — Session resume within X.** ✅ *Implemented Part 5 (2026-05-24) — `tests/e2e/m4-session-signals.spec.ts`.* Record an event, then return **within X** (autotest window 2s) via reload → the **same** session id resumes (no new session). Returning **after** X → a new session id. (Confirms session-resume + the localStorage-persisted id.)
- **Test 44 — Visibility events are not activity (session-merge regression guard).** ✅ *Added 2026-05-25; un-skipped M5 (2026-05-26) — `tests/e2e/m4-session-signals.spec.ts`.* Reproduces the session-merge bug: one real click sets the resume/idle clock, then only visibility events fire (a transform toggle crosses the observer threshold — no scroll/click) for longer than X; on reload the visit must start a **new** session id (not resume). **M5 fix:** `appendCheckoutHeatmapEvent` no longer touches `lastInteractionAt` when `resetActivity:false` — visibility events are recorded but do not count as activity. `.fixme` removed; test is active and green. **Suite: 54/54 green.**

### Open items for the plan (confirm during Part 1 implementation)
- **Zero-interaction recording trigger — RESOLVED.** A no-interaction visit is committed on exit (`pagehide`) and finalized only after the X grace window passes with no return (X = 30s normal, 2s autotest). See `PRODUCT_OVERVIEW.md` → M4 → "Session resume on return within X". Drives Test 1 / Test 36 / Test 41 assertions.
- **Default heatmap view** must remain click-dots (new views toggled) so click-precision tests stay valid — confirm in Part 6.

---

## M5 — Login Step + Individual Session Attribution

**Status: COMPLETE (2026-05-26). Parts 1–3 done. 58/58 active tests passing. All close gates met.** Numbering continues from M4 (Tests 45+). New test file `tests/e2e/m5-login.spec.ts` covers Tests 45–48.
**Framework:** Playwright, against `localhost:3000`, Neon Postgres store, isolated runner (`HEATMAP_DB_SCHEMA=heatmap_test`).

### Existing-test updates for M5

All test helpers that navigate to checkout now complete the M5 login step (fill `#login_name` + click Continue). The funnel lands on the login step instead of personal-info directly:

- **Type A helpers** (re-navigate on login step to add test params, then complete login): `m1-heatmap`, `m1-heatmap-anchor`, `m2-scanner-pi`, `m2-fixed-position`, `m3-query-api/navigateToPersonalInfo`, `m4-ingest`, `m4-mousemove-scroll`, `m4-rendering`, `m4-field-visibility`. Key: login step has capture disabled, so no stray sessions are created during re-navigation.
- **Type B helpers** (complete login inline after funnel, no re-navigate): `m4-step-nav`, `m2-delivery-pay`, `m2-viewer/navigateToCheckout`, `m3-query-api/navigateToCheckout`.
- **Type C helper** (direct URL to login step with/without test param, then complete login): `m4-session-signals/gotoCheckout`.
- **`m2-viewer/seedStepClick`** (special): checks `sessionStorage m1.login.done` via `page.evaluate`; first call navigates to `?step=login&m1HeatmapTest=1`, completes login (app preserves `m1HeatmapTest` through setStep → PI), then jumps to target step; subsequent calls skip login (gate already set).
- **App code fix** (`shopRuntime.js` + `page.jsx`): `getCheckoutHref` and the `setStep` handler preserve `m1HeatmapTest`, `m1HeatmapAnchor`, `heatmapSampleRate` from the current URL so the login→PI client navigation carries test params — preventing any double-navigation and the stray session it would create.

### New cases (Tests 45–48)

**Test 45 — Login step renders; login gate enforced.** ✅ *Implemented Part 3 (2026-05-26) — `tests/e2e/m5-login.spec.ts`.*
- Navigate to `?step=login` → Sign In heading, `#login_name` input, and Continue button must be visible.
- Navigate to `?step=personal-info` without prior login → login gate must redirect to login (Sign In heading visible).

**Test 46 — Empty name blocks Continue.** ✅ *Implemented Part 3 (2026-05-26) — `tests/e2e/m5-login.spec.ts`.*
- Navigate to `?step=login` → click Continue without filling the name field → `[data-field-error]` must appear, visitor must remain on the login step (Sign In heading visible, URL must not contain `step=personal-info`).

**Test 47 — Valid name advances to personal-info and writes visitor_id.** ✅ *Implemented Part 3 (2026-05-26) — `tests/e2e/m5-login.spec.ts`.*
- Navigate to `?step=login` → fill name → click Continue → URL must advance to `step=personal-info` and personal-info form must render.
- `localStorage[m1.heatmap.visitorId]` must be a v4 UUID.
- `sessionStorage[m1.login.done]` must be `"1"`.

**Test 48 — Sessions carry visitor_id; second login mints a different visitor_id.** ✅ *Implemented Part 3 (2026-05-26) — `tests/e2e/m5-login.spec.ts`.*
- First login → click tracked element → flush session → `GET /api/checkout-heatmap` → `sessions[0].visitorId` must equal the `localStorage[m1.heatmap.visitorId]` captured after login.
- Clear heatmap data → remove `m1.login.done` from sessionStorage → second login → `localStorage[m1.heatmap.visitorId]` must be a different UUID (mintVisitorId generates a fresh id on each login).

---

## M6 — Admin Dashboard (Parts 1–6)

**Status: CLOSED — All 6 parts done (2026-05-27). 66/66 active tests passing.** Numbering continues from M5 (Tests 49+). `tests/e2e/m6-config.spec.ts` covers Tests 49–53; `tests/e2e/m6-dashboard.spec.ts` covers Test 54; `tests/e2e/m6-heatmap-viewer.spec.ts` covers Tests 55–56.
**Framework:** Playwright, against `localhost:3000`, Neon Postgres store, isolated runner (`HEATMAP_DB_SCHEMA=heatmap_test`).
**Auth token (tests):** `DASHBOARD_TOKEN=m6-dev-token` in `.env.local`; tests use `Bearer m6-dev-token`.

### Existing-test updates for M6 Part 1

- **Test 37** (`m4-session-signals.spec.ts`): `advanced` → `completed` outcome assertion updated.
- **Test 42** (`m4-session-signals.spec.ts`): `advanced` → `completed` in the multi-step outcome assertion.

### New cases (Tests 49–53)

**Test 49 — GET /api/checkout-heatmap/config returns defaults when no row exists.** ✅ *Implemented P2 (2026-05-27) — `tests/e2e/m6-config.spec.ts`.*
- Delete the config row (reset to defaults) → `GET /api/checkout-heatmap/config` → assert `steps` has `personal-info`, `delivery`, `pay` all `true`; `eventTypes` has `click`, `mouse-move`, `scroll` all `true`; `samplingRate` is `1`; `captureWindow.from` and `.to` are `null`.

**Test 50 — POST saves config with valid token; wrong/missing token → 401.** ✅ *Implemented P2 (2026-05-27) — `tests/e2e/m6-config.spec.ts`.*
- `POST /api/checkout-heatmap/config` with no `Authorization` header → 401.
- `POST` with `Authorization: Bearer wrong-token` → 401.
- `POST` with `Authorization: Bearer m6-dev-token` and `{ samplingRate: 0.75, steps: { pay: false } }` → 200; subsequent `GET` reflects the saved values.

**Test 51 — Disabling a step in config prevents capture on that step.** ✅ *Implemented P3 (2026-05-27) — `tests/e2e/m6-config.spec.ts`.*
- Save config with `steps["personal-info"] = false` → navigate to personal-info → click a tracked element → dispatch `pagehide` → sweep → `GET /api/checkout-heatmap` → assert 0 sessions with `step: "personal-info"`.
- Gate is enforced server-side at ingest (timing-independent).

**Test 52 — Disabling mouse-move event type stops mouse-move capture.** ✅ *Implemented P3 (2026-05-27) — `tests/e2e/m6-config.spec.ts`.*
- Save config with `eventTypes["mouse-move"] = false` → navigate → move mouse repeatedly → click a tracked element → dispatch `pagehide` → sweep → assert ≥1 session exists (click still captured) but no session contains a `mouse-move` event.
- Event-type filter applied server-side at ingest (strips disabled event types before storage).

**Test 53 — Sampling rate 0% in config produces no sessions.** ✅ *Implemented P3 (2026-05-27) — `tests/e2e/m6-config.spec.ts`.*
- Save config with `samplingRate: 0` → clear cookies → navigate → click → dispatch `pagehide` → sweep → assert 0 sessions.
- Delete config (restore defaults) → clear cookies → same flow → assert ≥1 session (100% sampling).

**Test 54 — Dashboard auth gate + Data section renders + Save updates config + Clear-data wipes sessions.** ✅ *Implemented P4 (2026-05-27) — `tests/e2e/m6-dashboard.spec.ts`.*
- Navigate to `/dashboard?token=bad-token` → `[data-dashboard-blocked]` visible (wrong token → access denied).
- Navigate to `/dashboard` (no token) → `[data-dashboard-blocked]` visible.
- Navigate to `/dashboard?token=m6-dev-token` → all three `[data-dashboard-section]` headers (Data / Heatmap / Report) visible; Save button and Steps MultiSelect trigger present.
- Open the Steps MultiSelect → assert all three step options visible with `aria-pressed="true"` → click "pay" to toggle off (`aria-pressed="false"`) → click Save → assert "Saved" feedback appears → `GET /api/checkout-heatmap/config` returns `steps.pay === false`.
- Reload dashboard with defaults restored → open Steps MultiSelect → "pay" option has `aria-pressed="true"` (back to default).
- Seed a session via API → click "Clear all data" → confirmation pop-up appears → confirm → overlay closes → "All data cleared" feedback → `GET /api/checkout-heatmap` returns 0 sessions.
- Evidence: `test-results/Test 54 - Dashboard auth and Data section/Check evidence/dashboard.png`

**Test 55 — Viewer outcome filter: drop-offs, completers, all.** ✅ *Implemented P5 (2026-05-27) — `tests/e2e/m6-heatmap-viewer.spec.ts`.*
- Clear sessions → seed 1 `abandoned` session + 1 `completed` session (both `step=personal-info`, `view=desktop_view`).
- Open `/checkout/001/heatmap?step=personal-info&view=desktop_view&outcome=drop-offs` → `[data-heatmap-session-count]` shows `1`.
- Open same URL with `outcome=completers` → `[data-heatmap-session-count]` shows `1`.
- Open same URL with no `outcome` param → `[data-heatmap-session-count]` shows `2`.
- Evidence: `test-results/Test 55 - Viewer outcome filter/Check evidence/outcome-all.png`

**Test 56 — Viewer timeframe: out-of-range from/to shows 0 sessions.** ✅ *Implemented P5 (2026-05-27) — `tests/e2e/m6-heatmap-viewer.spec.ts`.*
- Clear sessions → seed 1 session (current timestamp, 2026).
- Open heatmap with `from=2000-01-01&to=2000-01-02` → `[data-heatmap-session-count]` shows `0`.
- Open same URL without timeframe params → `[data-heatmap-session-count]` shows `1`.
- Evidence: `test-results/Test 56 - Viewer timeframe filter/Check evidence/no-data.png`

### Existing-test updates for M6 Part 6

- **Test 2** (`m1-heatmap.spec.ts`): Rewritten — the TopBar Clear-data button was removed. Test now navigates to `/dashboard?token=m6-dev-token`, clicks `[data-dashboard-clear-data]`, confirms via `[data-dashboard-confirm-overlay]` → `[data-dashboard-confirm-clear]`, and asserts "All data cleared" feedback.
- **Test 3** (`m1-heatmap.spec.ts`): Rewritten — the TopBar Heatmap step dropdown was removed. Test now opens the dashboard Heatmap section, selects a step via `[data-dashboard-heatmap-step]`, clicks `[data-dashboard-heatmap-open]`, and asserts the viewer opens at the correct URL.
- **Test 19** (`m2-viewer.spec.ts`): `h1` and `div.text-xs.text-slate-500` assertions updated to use `[data-heatmap-step-label]` and `[data-heatmap-stats]`. Mobile toggle-link navigation replaced with direct URL `?view=mobile_view` navigation.
- **Tests 18 render-half** (`m2-delivery-pay.spec.ts`): `h1` assertions replaced with `[data-heatmap-step-label]`.
- **Test 39** (`m4-rendering.spec.ts`): `getByRole("link", { name: "See mouse moves" })` click replaced with `openHeatmap(page, "&type=moves")` direct navigation (in-viewer type toggle removed in P6).

---

## M6.1 — Heatmap Simulation Mode

**Status: CLOSED (2026-05-28). All 3 parts delivered. 73/73 active tests passing.** Scope frozen 2026-05-28 (`PRODUCT_OVERVIEW.md` → Future Milestones → M6.1). Architecture in `ARCHITECTURE_OVERVIEW.md` → "M6.1 architecture". Test plan produced by `milestone-test-planning` 2026-05-28.
**Suite:** kept 55 as-is, updated 1 (Test 54 — four dashboard sections), removed 0, added 7 new (Tests 57–63). New spec: `tests/e2e/m6-sim.spec.ts`.
**Framework:** Playwright, against `localhost:3000`, Neon Postgres store, isolated runner (`HEATMAP_DB_SCHEMA=heatmap_test`).
**Auth token (tests):** `DASHBOARD_TOKEN=m6-dev-token` in `.env.local`; tests use `Bearer m6-dev-token`.
**Test-DB schemas:** real data in `heatmap_test`; sim data in `heatmap_test_sim`. Both are wiped by `global-teardown.ts` after the suite.
**Infrastructure change (Part 3):** `tests/global-teardown.ts` must also truncate `heatmap_test_sim` after the suite, so simulated rows never persist across runs.

### Keep as-is (55)

Tests **1–53, 55–56** — simulation is additive and isolated. All real-data paths remain unchanged when no `source` param is present; no existing UI elements are removed or modified. Confirm the parameterized store still defaults to the base `SCHEMA` (a regression risk if a default arg is missed).

### Update (1)

**Test 54** (`m6-dashboard.spec.ts`) — dashboard now has **four** sections (Data / Heatmap / Simulation / Report). Update the visible-sections assertion to include `[data-dashboard-section="simulation"]`; change the count description from "three" to "four". No other assertion in Test 54 is affected.

### Remove
None.

### New cases (Tests 57–63)

All in `tests/e2e/m6-sim.spec.ts`.

**Test 57 — GET /simulate returns session count**
- `GET /api/checkout-heatmap/simulate` with no prior simulation → `{ count: 0 }` (or a response with `count` equal to 0).
- `POST /simulate` (auth) to generate → `GET /simulate` → `count` > 1000.
- Evidence: `test-results/M6.1 Test 57 - Simulate GET count/Check evidence/`

**Test 58 — POST and DELETE /simulate require auth**
- `POST /api/checkout-heatmap/simulate` no `Authorization` header → 401.
- `POST /api/checkout-heatmap/simulate` with `Authorization: Bearer wrong-token` → 401.
- `DELETE /api/checkout-heatmap/simulate` no auth → 401.
- `DELETE /api/checkout-heatmap/simulate` wrong token → 401.
- Evidence: `test-results/M6.1 Test 58 - Simulate auth gate/Check evidence/`

**Test 59 — Generate writes only to the sim schema (isolation)**
- Clear real data → seed 1 real session (via ingest with a valid payload).
- `POST /api/checkout-heatmap/simulate` with valid token → 200.
- `GET /api/checkout-heatmap` (no `source`) → exactly 1 session (real data untouched).
- `GET /api/checkout-heatmap?source=sim` → count > 1000 (sim sessions exist).
- Evidence: `test-results/M6.1 Test 59 - Generate isolation/Check evidence/`

**Test 60 — Discard wipes sim data only; real data intact**
- `POST /simulate` → confirm sim sessions exist (`GET ?source=sim` count > 0).
- Seed 1 real session.
- `DELETE /simulate` (auth) → 200.
- `GET /api/checkout-heatmap?source=sim` → `count` = 0.
- `GET /api/checkout-heatmap` (no source) → 1 real session still present.
- Evidence: `test-results/M6.1 Test 60 - Discard isolation/Check evidence/`

**Test 61 — Viewer renders sim data with source=sim; real heatmap unaffected**
- Clear real data; `POST /simulate` → sim sessions generated.
- Open `/checkout/001/heatmap?step=personal-info&source=sim` → `[data-heatmap-session-count]` > 1000 AND at least one click dot is rendered (click dots overlay present with data).
- Open `/checkout/001/heatmap?step=personal-info` (no source) → `[data-heatmap-session-count]` = 0 (no real sessions seeded).
- Evidence: `test-results/M6.1 Test 61 - Viewer sim source/Check evidence/`

**Test 62 — Generated distribution is approximately correct (outcome mix)**
- `POST /simulate` → `GET /api/checkout-heatmap?source=sim` → parse response.
- Total session count is between 1400 and 1600.
- Abandoned sessions ≥ 50% and ≤ 80% of total.
- Completed sessions ≥ 20% and ≤ 50% of total.
- At least one session carries `view: "desktop_view"` and at least one carries `view: "mobile_view"`.
- Evidence: `test-results/M6.1 Test 62 - Generated distribution/Check evidence/`

**Test 63 — Dashboard Simulation section: Generate, View Simulation, Discard**
- Navigate to `/dashboard?token=m6-dev-token` → `[data-dashboard-section="simulation"]` visible.
- Click **Generate** button (`[data-dashboard-sim-generate]`) → `[data-dashboard-sim-status]` updates to show a count > 1000 (not "No simulation data").
- Click **View Simulation** button (`[data-dashboard-sim-view]`) → new tab opens; URL contains `source=sim` and `step=personal-info`.
- Click **Discard** button (`[data-dashboard-sim-discard]`) → confirmation overlay appears → click confirm → overlay closes → `[data-dashboard-sim-status]` shows zero / "No simulation data".
- `GET /api/checkout-heatmap` (no source) → real sessions count is unchanged (discard did not touch real data).
- Evidence: `test-results/M6.1 Test 63 - Dashboard Simulation section/Check evidence/dashboard-sim.png`
