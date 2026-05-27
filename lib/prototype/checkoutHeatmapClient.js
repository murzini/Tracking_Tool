"use client";

import { useEffect } from "react";
import {
  CHECKOUT_HEATMAP_EXIT_REASONS,
  CHECKOUT_HEATMAP_INTERACTION_TYPES,
  CHECKOUT_HEATMAP_VIEWS,
  appendCheckoutHeatmapClick,
  appendCheckoutHeatmapEvent,
  createCheckoutHeatmapClick,
  createCheckoutHeatmapFieldEvent,
  createCheckoutHeatmapMouseMove,
  createCheckoutHeatmapScroll,
  createCheckoutHeatmapSession,
  createCheckoutHeatmapValidationError,
  createCheckoutHeatmapVisibility,
  finalizeCheckoutHeatmapSession,
  getCheckoutHeatmapInactivityMs,
  isCheckoutHeatmapDropOffCandidate,
  recordCheckoutHeatmapInteraction,
} from "./checkoutHeatmap";
import { scanCheckoutAnchors } from "./checkoutScanner";
import { resolveSamplingDecision } from "./checkoutHeatmapSampling";
import { clearResumeRef, loadResumableSessionId, persistResumeRef } from "./checkoutHeatmapResume";
import { getVisitorId } from "./checkoutVisitorId";

const ACTIVE_SESSION_STORAGE_KEY = "m1.checkoutHeatmap.activeSession";
const FLUSH_ACTIVE_SESSION_EVENT = "m1:checkout-heatmap-flush";
const COMPLETE_SESSION_EVENT = "m1:checkout-heatmap-complete";

// M4 Part 5: how close to a nav-causing click an exit must be to attribute the
// exit to that click (`nav-click`) rather than the catch-all `left-browser`.
const NAV_CLICK_EXIT_WINDOW_MS = 800;

// M4 Part 2: batched ingestion pipe.
const INGEST_URL = "/api/checkout-heatmap/ingest";
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_SIZE_THRESHOLD = 50;

// M4 Part 3: high-frequency capture throttles (time-based, ≈10 Hz).
const MOUSE_MOVE_THROTTLE_MS = 100;
const SCROLL_THROTTLE_MS = 100;

// M4 Part 4: fraction of an element that must be on screen to count as "seen".
// Tunable heuristic (50% is a fair "actually seen" mark — see ARCHITECTURE_OVERVIEW M4).
const VISIBILITY_THRESHOLD = 0.5;
const FIELD_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

function stripEvents(session) {
  const { events, ...rest } = session;
  return rest;
}

// M6 Part 2: fetch the active runtime config; fail-open to defaults so a transient
// error never silently loses capture.
const CONFIG_URL = "/api/checkout-heatmap/config";
async function fetchRuntimeConfig() {
  try {
    const res = await fetch(CONFIG_URL);
    if (res.ok) {
      const data = await res.json();
      if (data?.config && typeof data.config === "object") return data.config;
    }
  } catch { /* fail-open */ }
  return null; // null → caller uses defaults
}

// M6 Part 3: is now ∈ [captureWindow.from, captureWindow.to]?
function isCaptureWindowOpen(captureWindow) {
  if (!captureWindow) return true;
  const now = Date.now();
  if (captureWindow.from) {
    const from = new Date(captureWindow.from).getTime();
    if (Number.isFinite(from) && now < from) return false;
  }
  if (captureWindow.to) {
    const to = new Date(captureWindow.to).getTime();
    if (Number.isFinite(to) && now > to) return false;
  }
  return true;
}

export function useCheckoutHeatmapCapture({ enabled, sku, step, automation = false, inactivityMs } = {}) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    // M6 Part 3: runtime config starts null; event-type/element-type gates fail-open
    // until the background fetch below resolves. Step/window/sampling gates are
    // applied via background abort so capture setup is never blocked on a network call.
    let runtimeConfig = null;
    let cancelled = false;

    // M4 Part 2: visitor-level sampling gate. Sync decision uses env/default rate;
    // the background config gate below aborts if the runtime samplingRate is 0.
    const { sampled, rate } = resolveSamplingDecision(window.location.search, undefined);
    if (!sampled) return undefined;

    const threshold = getCheckoutHeatmapInactivityMs({ automation, overrideMs: inactivityMs });
    let finalizeTimer = null;
    let finalized = false;
    let session = createCheckoutHeatmapSession({
      sku,
      step,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      inactivityMs: threshold,
    });
    session.samplingRate = rate;
    session.visitorId = getVisitorId();

    // M4 Part 5: session resume. If the visitor returns to this same step+sku
    // within the grace window X (= the inactivity threshold), reuse the persisted
    // session id so events keep appending to the same session (the server upsert
    // preserves the original started_at). Otherwise this is a fresh session.
    const resumedId = loadResumableSessionId({ step, sku: session.sku, windowMs: threshold });
    if (resumedId) session.id = resumedId;
    const touchResume = () => persistResumeRef({ id: session.id, step, sku: session.sku });
    touchResume();

    persistActiveSession(session);
    let saving = false;

    // M4 Part 5: how the visitor left, resolved at finalize/exit time.
    //  - `back`        — a popstate was observed
    //  - `nav-click`   — the last click (just before the exit) navigated away
    //  - `left-browser`— an unload with none of the above (tab close, typed URL…)
    //  - `idle`        — the inactivity timer elapsed with the tab still open
    //    (the default applied in finalizeCheckoutHeatmapSession)
    let sawBack = false;
    let lastNavClick = null; // { anchorId, at }

    // M4 Part 2: ring buffer of events not yet confirmed delivered. Events stream
    // to the ingest endpoint in batches (interval/size flush + unload beacon)
    // rather than via a single finalize-only POST.
    let pending = [];
    let flushInterval = null;

    const flushPending = async () => {
      if (finalized || saving || !pending.length) return;
      const batch = pending.slice();
      try {
        const response = await fetch(INGEST_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ session: stripEvents(session), events: batch }),
        });
        if (response.ok) {
          const sentIds = new Set(batch.map((e) => e.id));
          pending = pending.filter((e) => !sentIds.has(e.id));
        }
      } catch {
        // Best-effort; events stay in `pending` for the next flush.
      }
    };

    const flushViaBeacon = () => {
      if (finalized || typeof navigator.sendBeacon !== "function") return;
      // Note: do NOT refresh the resume "last seen" here. The resume window is
      // measured from the last in-page activity (set on mount + each interaction),
      // so a visitor idle past X before leaving correctly starts a new session on
      // return rather than resuming a session that has already dropped off.
      try {
        // M4 Part 5: commit the session on unload even with zero events — a
        // zero-interaction bounce must still be recorded. Send ALL events (not
        // just the pending buffer) so an abrupt close keeps field/visibility
        // events too. The session is NOT finalized here: the server sweep derives
        // the dropped-off state after the grace window X. The best-guess exit
        // reason rides along; the sweep keeps it (COALESCE) when finalizing.
        const exitSession = { ...stripEvents(session), exitReason: resolveExitReason({ unload: true }) };
        const payload = JSON.stringify({ session: exitSession, events: session.events });
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon(INGEST_URL, blob)) pending = [];
      } catch {
        // Beacon is fire-and-forget; nothing to recover on a closing page.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushViaBeacon();
    };

    flushInterval = window.setInterval(flushPending, FLUSH_INTERVAL_MS);

    const clearFinalizeTimer = () => {
      if (!finalizeTimer) return;
      window.clearTimeout(finalizeTimer);
      finalizeTimer = null;
    };

    // M4 Part 5: classify how the visitor left. `unload` distinguishes a real
    // page unload (→ left-browser when nothing more specific is known) from the
    // inactivity timer firing with the tab still open (→ null, so finalize
    // defaults to idle).
    const resolveExitReason = ({ unload = false } = {}) => {
      if (sawBack) return CHECKOUT_HEATMAP_EXIT_REASONS.BACK;
      if (lastNavClick && Date.now() - lastNavClick.at <= NAV_CLICK_EXIT_WINDOW_MS) {
        return CHECKOUT_HEATMAP_EXIT_REASONS.NAV_CLICK;
      }
      return unload ? CHECKOUT_HEATMAP_EXIT_REASONS.LEFT_BROWSER : null;
    };

    const saveSession = async ({ force = false, outcome } = {}) => {
      if (finalized || saving) return false;
      if (!outcome && !force && !isCheckoutHeatmapDropOffCandidate(session, { inactivityMs: threshold })) return false;

      saving = true;
      clearFinalizeTimer();

      const finalizedSession = finalizeCheckoutHeatmapSession(session, {
        inactivityMs: threshold,
        outcome,
        exitReason: outcome ? null : resolveExitReason(),
      });

      try {
        // The whole session + all its events are flushed through the batched
        // ingest pipe (idempotent on the server), guaranteeing nothing buffered
        // is lost.
        const response = await fetch(INGEST_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            session: stripEvents(finalizedSession),
            events: finalizedSession.events,
          }),
        });
        if (!response.ok) throw new Error("Failed to save heatmap session.");
        finalized = true;
        pending = [];
        if (flushInterval) window.clearInterval(flushInterval);
        clearActiveSession();
        clearResumeRef();
        return true;
      } catch {
        // M1 capture is best-effort; failed writes should not break checkout.
        persistActiveSession(session);
        if (!outcome) scheduleFinalize();
        return false;
      } finally {
        saving = false;
      }
    };

    // M4 Part 5: explicit success finalize on step navigation. The checkout page
    // calls this (via the exported flush helper) the moment a CTA advances the
    // visitor — `advanced` on a step→step move, `completed` on finishing checkout.
    const completeSession = (outcome) => saveSession({ force: true, outcome });

    const finalizeIfDroppedOff = () => {
      saveSession();
    };

    const scheduleFinalize = () => {
      // Refresh the resume "last seen" so a quick return resumes this session.
      touchResume();
      clearFinalizeTimer();
      finalizeTimer = window.setTimeout(finalizeIfDroppedOff, threshold);
    };

    const updateInteraction = (timestamp = Date.now()) => {
      if (finalized) return;
      session = recordCheckoutHeatmapInteraction(session, { timestamp });
      persistActiveSession(session);
      scheduleFinalize();
    };

    let pointerDownPos = null;

    const handlePointerDown = (event) => {
      if (!isPrimaryPointerRelease(event)) return;
      pointerDownPos = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event) => {
      if (finalized || !isPrimaryPointerRelease(event)) return;
      if (isIgnoredHeatmapEvent(event)) return;

      if (event.pointerType === "touch" && pointerDownPos) {
        const dx = event.clientX - pointerDownPos.x;
        const dy = event.clientY - pointerDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) return;
      }

      const point = getSurfacePoint(event);
      const type =
        event.pointerType === "touch"
          ? CHECKOUT_HEATMAP_INTERACTION_TYPES.TAP
          : CHECKOUT_HEATMAP_INTERACTION_TYPES.CLICK;

      if (!isEventTypeEnabled(type)) return;

      const click = createCheckoutHeatmapClick({
        x: point.x,
        y: point.y,
        type,
        timestamp: Date.now(),
        target: readTargetMeta(event),
        uiState: readUiState(point.y),
        anchor: findNearestAnchor(event, point),
        debug: null,
      });

      // P3: element-type gate — skip if the resolved anchor's type is disabled.
      if (!isElementTypeEnabled(click.anchor?.type)) return;

      session = appendCheckoutHeatmapClick(session, click);
      pending.push(click);

      // M4 Part 5: best-effort nav-click exit detection. A click on an in-page
      // link that navigates away (an <a href>) is a candidate exit cause; if the
      // page then unloads shortly after, the exit is attributed to this click
      // rather than the catch-all `left-browser`. The CTA (a button → step
      // advance) and chatbot (in-page panel) are not links, so they never qualify.
      const navTarget = typeof event.target?.closest === "function" ? event.target.closest("a[href]") : null;
      if (navTarget) lastNavClick = { anchorId: click.anchor?.id ?? null, at: Date.now() };

      persistActiveSession(session);
      scheduleFinalize();
      if (pending.length >= FLUSH_SIZE_THRESHOLD) flushPending();
    };

    const handleActivity = (event) => {
      if (isIgnoredHeatmapEvent(event)) return;
      updateInteraction(Date.now());
    };

    // M4 Part 3: buffer a non-click event (mouse-move, scroll). Mirrors the click
    // path — append to the session + ring buffer, treat it as activity (keep the
    // session alive), and trip the size-based flush.
    const bufferEvent = (event) => {
      if (finalized) return;
      session = appendCheckoutHeatmapEvent(session, event);
      pending.push(session.events[session.events.length - 1]);
      persistActiveSession(session);
      scheduleFinalize();
      if (pending.length >= FLUSH_SIZE_THRESHOLD) flushPending();
    };

    // M4 Part 4: append a captured event to the session WITHOUT putting it on the
    // live `pending` stream buffer. These events are persisted with everything else
    // when the session is saved (drop-off finalize). This keeps Part 4 purely about
    // *what* is captured and changes no session-persistence/lifecycle behaviour —
    // robust exit + server-side finalize is Part 5. It still counts as activity, so
    // a click-bearing session is kept alive while the visitor reads/edits.
    // `resetActivity` controls whether this event counts as the visitor being
    // active. User-driven events (field focus/blur/change) do; observer-driven
    // events (element visibility) do NOT — visibility callbacks fire on their own
    // (and can thrash), so counting them as activity would keep the session alive
    // and the resume window open with no real user input (see element visibility
    // below). The business rule for "idle" is no clicks/typing/scrolling/movement —
    // visibility is not in that list.
    const recordSessionEvent = (event, { resetActivity = true } = {}) => {
      if (finalized || !event) return;
      session = appendCheckoutHeatmapEvent(session, event, { resetActivity });
      persistActiveSession(session);
      if (resetActivity) scheduleFinalize();
    };

    // M4 Part 4: field events. We never read the typed value — only whether the
    // field is filled and its length. `field-change` fires on blur (commit) when
    // the value changed, not on every keystroke. The field is identified by its
    // anchor id, NOT its DOM node: controlled inputs/selects remount on change
    // (the StickyInput tech debt), so the node identity is not stable across a
    // focus→change→blur sequence.
    let focusedField = null;

    const handleFieldFocusIn = (event) => {
      if (!isEventTypeEnabled("field-focus")) return;
      if (finalized) return;
      const el = event.target;
      if (!el || !FIELD_TAGS.has(el.tagName) || isIgnoredHeatmapEvent(event)) return;
      const anchor = resolveAnchorForElement(el);
      if (!anchor) return;
      // A remount re-fires focus on the same field — keep the original
      // valueAtFocus and don't double-record the focus.
      if (focusedField && focusedField.anchorId === anchor.id) return;
      const { value, filled } = readFieldState(el);
      focusedField = { anchorId: anchor.id, anchorType: anchor.type, valueAtFocus: value };
      recordSessionEvent(
        createCheckoutHeatmapFieldEvent({
          type: CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_FOCUS,
          anchor,
          filled,
          length: value.length,
        })
      );
    };

    const handleFieldFocusOut = (event) => {
      if (!isEventTypeEnabled("field-blur") && !isEventTypeEnabled("field-change")) return;
      if (finalized) return;
      const el = event.target;
      if (!el || !FIELD_TAGS.has(el.tagName)) return;
      const anchor = resolveAnchorForElement(el);
      // Ignore focusout on a detached/old node (anchor unresolved) or a different
      // field — the tracked field may still be focused after a remount.
      if (!focusedField || !anchor || anchor.id !== focusedField.anchorId) return;
      const { value, filled } = readFieldState(el);
      recordSessionEvent(
        createCheckoutHeatmapFieldEvent({
          type: CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_BLUR,
          anchor,
          filled,
          length: value.length,
        })
      );
      if (value !== focusedField.valueAtFocus) {
        recordSessionEvent(
          createCheckoutHeatmapFieldEvent({
            type: CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_CHANGE,
            anchor,
            filled,
            length: value.length,
          })
        );
      }
      focusedField = null;
    };

    // M4 Part 4: validation-error-shown. A MutationObserver watches the surface for
    // error messages (`data-field-error`, scanned as `error`-type anchors) appearing,
    // and records a `validation-error` event the first time each one becomes visible
    // (distinct from a click on the error). Pre-existing errors at mount are seeded
    // without emitting.
    const shownErrorIds = new Set();
    const scanErrorAnchors = () => scanCheckoutAnchors(document).filter((a) => a.type === "error");
    for (const a of scanErrorAnchors()) shownErrorIds.add(a.id);

    let validationCheckQueued = false;
    const checkValidationErrors = () => {
      validationCheckQueued = false;
      if (!isEventTypeEnabled("validation-error")) return;
      if (finalized) return;
      const current = scanErrorAnchors();
      const currentIds = new Set(current.map((a) => a.id));
      for (const a of current) {
        if (!shownErrorIds.has(a.id)) {
          shownErrorIds.add(a.id);
          recordSessionEvent(createCheckoutHeatmapValidationError({ anchor: { id: a.id, type: a.type } }));
        }
      }
      for (const id of Array.from(shownErrorIds)) {
        if (!currentIds.has(id)) shownErrorIds.delete(id);
      }
    };
    const queueValidationCheck = () => {
      if (validationCheckQueued) return;
      validationCheckQueued = true;
      window.setTimeout(checkValidationErrors, 50);
    };
    const validationObserver = new MutationObserver(queueValidationCheck);
    validationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-field-error"],
    });

    // M4 Part 4: element visibility. An IntersectionObserver over every scanned
    // anchor records element-visible when an element crosses the 50% threshold and
    // element-hidden (with the visible duration) when it drops back below it. The
    // observer's initial report seeds each element's state WITHOUT emitting, so a
    // fresh page load with no user action produces no events (zero-interaction
    // handling is Part 5); only post-load transitions (driven by scrolling) emit.
    const visibilityState = new Map();
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        if (!isEventTypeEnabled("element-visible") && !isEventTypeEnabled("element-hidden")) return;
        if (finalized) return;
        const now = Date.now();
        for (const entry of entries) {
          const state = visibilityState.get(entry.target);
          if (!state) continue;
          const isVisible = entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD;
          if (!state.seeded) {
            state.seeded = true;
            state.visibleSince = isVisible ? now : null;
            continue;
          }
          if (isVisible && state.visibleSince == null) {
            state.visibleSince = now;
            recordSessionEvent(
              createCheckoutHeatmapVisibility({
                type: CHECKOUT_HEATMAP_INTERACTION_TYPES.ELEMENT_VISIBLE,
                anchor: state.anchor,
                timestamp: now,
              }),
              { resetActivity: false }
            );
          } else if (!isVisible && state.visibleSince != null) {
            const visibleMs = now - state.visibleSince;
            state.visibleSince = null;
            recordSessionEvent(
              createCheckoutHeatmapVisibility({
                type: CHECKOUT_HEATMAP_INTERACTION_TYPES.ELEMENT_HIDDEN,
                anchor: state.anchor,
                visibleMs,
                timestamp: now,
              }),
              { resetActivity: false }
            );
          }
        }
      },
      { threshold: [0, VISIBILITY_THRESHOLD, 1] }
    );

    for (const a of scanCheckoutAnchors(document)) {
      if (a.element && !visibilityState.has(a.element)) {
        visibilityState.set(a.element, { anchor: { id: a.id, type: a.type }, visibleSince: null, seeded: false });
        visibilityObserver.observe(a.element);
      }
    }

    // M6 Part 3: event-type gate helper. Missing key → enabled (fail-open).
    const isEventTypeEnabled = (type) => runtimeConfig?.eventTypes?.[type] !== false;
    const isElementTypeEnabled = (type) => !type || runtimeConfig?.elementTypes?.[type] !== false;

    // Movement capture. Desktop records the mouse pointer (mousemove); mobile records
    // finger movement (touchmove), reusing the same mouse-move event type + renderers
    // (M4 Part 7). The view is fixed at session start, so each path is gated to its
    // view. Mobile touchmove intentionally includes scroll swipes; scroll depth keeps
    // its own separate capture. Movement is not a drop-off activity (per the M1
    // inactivity definition), so neither path resets the idle timer.
    let lastMouseMoveAt = 0;
    const handleMouseMove = (event) => {
      if (!isEventTypeEnabled("mouse-move")) return;
      if (finalized || session.view !== CHECKOUT_HEATMAP_VIEWS.DESKTOP) return;
      const now = Date.now();
      if (now - lastMouseMoveAt < MOUSE_MOVE_THROTTLE_MS) return;
      lastMouseMoveAt = now;
      const point = getSurfacePoint(event);
      bufferEvent(createCheckoutHeatmapMouseMove({ x: point.x, y: point.y, timestamp: now }));
    };

    let lastTouchMoveAt = 0;
    const handleTouchMove = (event) => {
      if (!isEventTypeEnabled("mouse-move")) return;
      if (finalized || session.view !== CHECKOUT_HEATMAP_VIEWS.MOBILE) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const now = Date.now();
      if (now - lastTouchMoveAt < MOUSE_MOVE_THROTTLE_MS) return;
      lastTouchMoveAt = now;
      const point = getSurfacePoint({
        clientX: touch.clientX,
        clientY: touch.clientY,
        pageX: touch.pageX,
        pageY: touch.pageY,
      });
      bufferEvent(createCheckoutHeatmapMouseMove({ x: point.x, y: point.y, timestamp: now }));
    };

    // Scroll always counts as activity (M1 inactivity definition) even when the
    // depth has not changed; a depth-bearing event is only recorded on a throttled
    // tick when the depth actually moved, so identical-depth ticks are not stored.
    let lastScrollAt = 0;
    let lastScrollDepth = -1;
    const handleScroll = (event) => {
      if (!isEventTypeEnabled("scroll")) return;
      if (finalized || isIgnoredHeatmapEvent(event)) return;
      scheduleFinalize();
      const now = Date.now();
      if (now - lastScrollAt < SCROLL_THROTTLE_MS) return;
      lastScrollAt = now;
      const depth = computeScrollDepth();
      if (depth === lastScrollDepth) return;
      lastScrollDepth = depth;
      bufferEvent(createCheckoutHeatmapScroll({ depth, scrollY: getScrollY(), timestamp: now }));
    };

    const handleFlushActiveSession = () => saveSession({ force: true });
    window.__m1CheckoutHeatmapFlush = handleFlushActiveSession;

    // M4 Part 5: explicit success finalize (advanced/completed), fired by the
    // checkout page when a CTA advances the visitor to the next step.
    const handleCompleteSession = (event) => completeSession(event?.detail?.outcome);
    window.__m1CheckoutHeatmapComplete = completeSession;

    // M4 Part 5: the browser Back button. Mark the exit reason and commit the
    // session (best-effort — a SPA back unmounts without a pagehide beacon).
    const handlePopState = () => {
      sawBack = true;
      flushViaBeacon();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("mousemove", handleMouseMove, { capture: true, passive: true });
    window.addEventListener("touchmove", handleTouchMove, { capture: true, passive: true });
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("keydown", handleActivity, true);
    window.addEventListener("focusin", handleActivity, true);
    window.addEventListener("input", handleActivity, true);
    window.addEventListener("change", handleActivity, true);
    window.addEventListener("focusin", handleFieldFocusIn, true);
    window.addEventListener("focusout", handleFieldFocusOut, true);
    window.addEventListener(FLUSH_ACTIVE_SESSION_EVENT, handleFlushActiveSession);
    window.addEventListener(COMPLETE_SESSION_EVENT, handleCompleteSession);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", flushViaBeacon);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const doCleanup = () => {
      clearFinalizeTimer();
      if (flushInterval) window.clearInterval(flushInterval);
      validationObserver.disconnect();
      visibilityObserver.disconnect();
      clearActiveSession();
      if (window.__m1CheckoutHeatmapFlush === handleFlushActiveSession) {
        delete window.__m1CheckoutHeatmapFlush;
      }
      if (window.__m1CheckoutHeatmapComplete === completeSession) {
        delete window.__m1CheckoutHeatmapComplete;
      }
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("touchmove", handleTouchMove, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleActivity, true);
      window.removeEventListener("focusin", handleActivity, true);
      window.removeEventListener("input", handleActivity, true);
      window.removeEventListener("change", handleActivity, true);
      window.removeEventListener("focusin", handleFieldFocusIn, true);
      window.removeEventListener("focusout", handleFieldFocusOut, true);
      window.removeEventListener(FLUSH_ACTIVE_SESSION_EVENT, handleFlushActiveSession);
      window.removeEventListener(COMPLETE_SESSION_EVENT, handleCompleteSession);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", flushViaBeacon);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };

    // M6 Part 3: background config gate. Fires without blocking capture setup —
    // fail-open while null. Aborts the session (discard + remove listeners) if:
    //   • the step is explicitly disabled
    //   • the capture window is closed
    //   • the runtime sampling rate is 0% (never-sample policy)
    // Any events captured before config arrives are discarded on abort (pending=[]).
    fetchRuntimeConfig().then((config) => {
      if (cancelled || finalized) return;
      runtimeConfig = config;
      const abort = () => { finalized = true; pending = []; doCleanup(); clearResumeRef(); };
      if (runtimeConfig?.steps?.[step] === false) { abort(); return; }
      if (!isCaptureWindowOpen(runtimeConfig?.captureWindow)) { abort(); return; }
      const configRate = typeof runtimeConfig?.samplingRate === "number" ? runtimeConfig.samplingRate : 1;
      if (configRate <= 0) { abort(); return; }
    });

    return () => {
      cancelled = true;
      doCleanup();
    };
  }, [automation, enabled, inactivityMs, sku, step]);
}

export async function flushCheckoutHeatmapSession() {
  if (typeof window === "undefined") return;
  if (typeof window.__m1CheckoutHeatmapFlush === "function") {
    await window.__m1CheckoutHeatmapFlush();
    return;
  }
  window.dispatchEvent(new Event(FLUSH_ACTIVE_SESSION_EVENT));
}

// M4 Part 5: finalize the active session with a success outcome on step advance.
// Fire-and-forget — the underlying flush uses a keepalive fetch that survives the
// imminent route change, so the caller can navigate immediately afterwards.
export function flushCheckoutHeatmapOutcome(outcome) {
  if (typeof window === "undefined") return;
  if (typeof window.__m1CheckoutHeatmapComplete === "function") {
    window.__m1CheckoutHeatmapComplete(outcome);
    return;
  }
  window.dispatchEvent(new CustomEvent(COMPLETE_SESSION_EVENT, { detail: { outcome } }));
}

function isPrimaryPointerRelease(event) {
  if (!event) return false;
  if (event.isPrimary === false) return false;
  if (event.pointerType === "mouse" && event.button !== 0) return false;
  return Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
}

function isIgnoredHeatmapEvent(event) {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(target.closest('[data-heatmap-ignore="true"]'));
}

// M4 Part 4: the field's filled state + length — never the raw value. For
// checkbox/radio the "value" is its checked state.
function readFieldState(el) {
  const type = (el.getAttribute("type") || "").toLowerCase();
  if (type === "checkbox" || type === "radio") {
    const value = el.checked ? "on" : "";
    return { value, filled: Boolean(el.checked) };
  }
  const value = typeof el.value === "string" ? el.value : "";
  return { value, filled: value.trim().length > 0 };
}

// M4 Part 4: resolve a focused element to its scanned anchor ({ id, type }). The
// element itself is usually a scanned anchor (inputs are auto-discovered); fall
// back to the nearest scanned ancestor.
function resolveAnchorForElement(el) {
  const anchors = scanCheckoutAnchors(document);
  let found = anchors.find((a) => a.element === el);
  if (!found) found = anchors.find((a) => a.element && typeof a.element.contains === "function" && a.element.contains(el));
  return found ? { id: found.id, type: found.type } : null;
}

function readTargetMeta(event) {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") return null;

  const element = findHeatmapElement(target);
  const anchor = findNearestHeatmapAnchor(event);
  const targetMeta = element ? readElementMeta(element, event) : null;
  const anchorMeta = anchor ? readElementMeta(anchor, event) : null;

  if (!targetMeta && !anchorMeta) return null;
  return {
    ...(targetMeta || anchorMeta),
    anchor: anchorMeta,
  };
}

function readElementMeta(element, event) {
  const rect = element.getBoundingClientRect();

  return {
    tagName: element.tagName,
    role: element.getAttribute("role"),
    label:
      element.getAttribute("data-heatmap-label") ||
      element.getAttribute("aria-label") ||
      element.textContent?.trim() ||
      element.getAttribute("placeholder"),
    name: element.getAttribute("name") || element.getAttribute("id"),
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
}

function findHeatmapElement(target) {
  const selectors = [
    "[data-heatmap-label]",
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "label",
    "[role]",
  ].join(",");

  const direct = target.closest(selectors);
  if (direct) return direct;

  let node = target.nodeType === 1 ? target : target.parentElement;
  while (node && node !== document.body) {
    const text = node.textContent?.trim();
    const rect = node.getBoundingClientRect();
    if (text && text.length <= 180 && rect.width > 0 && rect.height > 0 && rect.width <= 420 && rect.height <= 220) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

function findNearestHeatmapAnchor(event) {
  const candidates = Array.from(
    document.querySelectorAll("[data-heatmap-label],button,a,input,select,textarea,label,[role],h1,h2,h3,h4,p")
  ).filter((element) => {
    const rect = element.getBoundingClientRect();
    const text = element.getAttribute("data-heatmap-label") || element.getAttribute("aria-label") || element.textContent?.trim() || element.getAttribute("placeholder");
    return text && rect.width > 0 && rect.height > 0;
  });

  let best = null;
  let bestDistance = Infinity;

  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    const closestX = Math.max(rect.left, Math.min(event.clientX, rect.right));
    const closestY = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
    const dx = event.clientX - closestX;
    const dy = event.clientY - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const areaPenalty = Math.min(80, (rect.width * rect.height) / 8000);
    const score = distance + areaPenalty;

    if (score < bestDistance) {
      best = element;
      bestDistance = score;
    }
  }

  return best;
}

function readUiState(surfaceRelativeY) {
  const personalInfoStep = document.querySelector('[data-checkout-heatmap-surface="personal-info-step"]');
  const validationVisible = Boolean(personalInfoStep?.textContent?.includes("Required field"));
  return {
    validationVisible,
    validationYShift: validationVisible ? measureValidationHeightAbove(surfaceRelativeY) : 0,
    openAccordions: Array.from(document.querySelectorAll('[data-state="open"]'))
      .map((element) => element.textContent?.trim())
      .filter(Boolean)
      .slice(0, 10),
  };
}

function measureValidationHeightAbove(surfaceRelativeY) {
  const surface = document.querySelector('[data-checkout-heatmap-surface="shop-content"]');
  if (!surface) return 0;
  const errors = Array.from(surface.querySelectorAll("[data-field-error]"));
  if (!errors.length) return 0;
  const surfaceRect = surface.getBoundingClientRect();
  const SAME_ROW_PX = 20;
  const raw = errors
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const marginTop = parseFloat(window.getComputedStyle(el).marginTop) || 0;
      return { top: rect.top - surfaceRect.top, height: rect.height + marginTop };
    })
    .filter((e) => e.top < surfaceRelativeY)
    .sort((a, b) => a.top - b.top);
  const groups = [];
  for (const entry of raw) {
    const last = groups[groups.length - 1];
    if (last && entry.top - last.top <= SAME_ROW_PX) {
      last.height = Math.max(last.height, entry.height);
    } else {
      groups.push({ top: entry.top, height: entry.height });
    }
  }
  return groups.reduce((sum, g) => sum + g.height, 0);
}

function getSurfacePoint(event) {
  const surface =
    document.querySelector('[data-checkout-heatmap-surface="shop-content"]') ||
    document.querySelector('[data-checkout-heatmap-surface="personal-info-step"]') ||
    document.querySelector('[data-checkout-heatmap-surface="shop-frame"]');
  if (!surface) {
    return {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
      surfaceRect: null,
      debug: {
        clientX: event.clientX,
        clientY: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        calculatedX: event.clientX + window.scrollX,
        calculatedY: event.clientY + window.scrollY,
        surfaceName: "document",
      },
    };
  }

  const rect = surface.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  return {
    x,
    y,
    surfaceRect: rect,
    debug: {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      surfaceLeft: rect.left,
      surfaceTop: rect.top,
      surfacePageLeft: rect.left + window.scrollX,
      surfacePageTop: rect.top + window.scrollY,
      surfaceWidth: rect.width,
      surfaceHeight: rect.height,
      calculatedX: x,
      calculatedY: y,
      surfaceName: surface.getAttribute("data-checkout-heatmap-surface"),
    },
  };
}

function findNearestAnchor(event, surfacePoint) {
  const surface = document.querySelector('[data-checkout-heatmap-surface="shop-content"]');
  if (!surface) return null;
  const surfaceRect = surface.getBoundingClientRect();

  // Live DOM discovery is the source of truth (M2). The scanner yields every
  // trackable element — tagged, auto-discovered, and error messages — each with
  // its stable anchor id and type.
  const candidates = scanCheckoutAnchors(document).map(({ id, type, element }) => {
    const rect = element.getBoundingClientRect();

    const closestX = Math.max(rect.left, Math.min(event.clientX, rect.right));
    const closestY = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
    const edgeDist = Math.sqrt((event.clientX - closestX) ** 2 + (event.clientY - closestY) ** 2);

    const centerX = rect.left + rect.width / 2 - surfaceRect.left;
    const centerY = rect.top + rect.height / 2 - surfaceRect.top;

    const isOnElement =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    return { id, type, edgeDist, centerX, centerY, isOnElement, area: rect.width * rect.height };
  });

  if (!candidates.length) return null;
  // Nearest by edge distance; on ties prefer the smaller (more specific) element
  // so a click inside a large container still anchors to the control under it.
  candidates.sort((a, b) => a.edgeDist - b.edgeDist || a.area - b.area);
  const nearest = candidates[0];

  if (nearest.isOnElement) {
    return { id: nearest.id, type: nearest.type, dx: 0, dy: 0 };
  }
  return {
    id: nearest.id,
    type: nearest.type,
    dx: Math.round(surfacePoint.x - nearest.centerX),
    dy: Math.round(surfacePoint.y - nearest.centerY),
  };
}

function getScrollY() {
  return Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
}

// Scroll depth as a 0-100 percentage of the page's scrollable height. A page that
// does not scroll (content fits the viewport) reports 0.
function computeScrollDepth() {
  const doc = document.documentElement;
  const scrollable = Math.max(0, (doc?.scrollHeight || 0) - window.innerHeight);
  if (scrollable <= 0) return 0;
  const ratio = getScrollY() / scrollable;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

function persistActiveSession(session) {
  try {
    window.sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

function clearActiveSession() {
  try {
    window.sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {}
}
