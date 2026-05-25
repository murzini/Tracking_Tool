import { BREAKPOINTS } from "../ui/breakpoints";

export const CHECKOUT_HEATMAP_VERSION = 1;

export const CHECKOUT_HEATMAP_STEPS = {
  PERSONAL_INFO: "personal-info",
  DELIVERY: "delivery",
  PAY: "pay",
};

export const CHECKOUT_HEATMAP_DEFAULT_STEP = CHECKOUT_HEATMAP_STEPS.PERSONAL_INFO;

export function resolveCheckoutHeatmapStep(step) {
  return Object.values(CHECKOUT_HEATMAP_STEPS).includes(step) ? step : CHECKOUT_HEATMAP_DEFAULT_STEP;
}

export const CHECKOUT_HEATMAP_VIEWS = {
  DESKTOP: "desktop_view",
  MOBILE: "mobile_view",
};

export const CHECKOUT_HEATMAP_CONFIG = {
  manualInactivityMs: 30000,
  automationInactivityMs: 2000,
  minRadiusPx: 6,
  maxRadiusPx: 24,
  desktopBreakpointPx: BREAKPOINTS.DESKTOP,
  mobileViewportWidthPx: 390,
};

export const CHECKOUT_HEATMAP_COORDINATE_SCOPE = "shop-content-v4";

export const CHECKOUT_HEATMAP_INTERACTION_TYPES = {
  CLICK: "click",
  TAP: "tap",
  SCROLL: "scroll",
  MOUSE_MOVE: "mouse-move",
  FOCUS: "focus",
  KEY: "key",
  CHANGE: "change",
  // M4 Part 4 — field, validation, and visibility events.
  FIELD_FOCUS: "field-focus",
  FIELD_BLUR: "field-blur",
  FIELD_CHANGE: "field-change",
  VALIDATION_ERROR: "validation-error",
  ELEMENT_VISIBLE: "element-visible",
  ELEMENT_HIDDEN: "element-hidden",
};

const FIELD_EVENT_TYPES = new Set([
  CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_FOCUS,
  CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_BLUR,
  CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_CHANGE,
]);

// M4 Part 5 — step outcome + exit reason.
// `advanced` / `completed` are successes (the visitor finished the step / the
// whole checkout); `abandoned` is a drop-off. Exit reason only applies to a
// drop-off — how the visitor left a step they did not complete.
export const CHECKOUT_HEATMAP_OUTCOMES = {
  ADVANCED: "advanced",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
  // M4 Part 6 — a session that has started but not yet resolved. Replaces the
  // bare `null` for committed-but-unfinalized sessions so an active session reads
  // as an explicit state. Resolves to a terminal outcome on advance or sweep.
  IN_PROGRESS: "in-progress",
};

// The resolved/terminal outcomes. Once a session carries one of these it is
// settled — an incoming `in-progress` must never overwrite it (M4 Part 6 guard).
export const CHECKOUT_HEATMAP_TERMINAL_OUTCOMES = [
  CHECKOUT_HEATMAP_OUTCOMES.ADVANCED,
  CHECKOUT_HEATMAP_OUTCOMES.COMPLETED,
  CHECKOUT_HEATMAP_OUTCOMES.ABANDONED,
];

export const CHECKOUT_HEATMAP_EXIT_REASONS = {
  IDLE: "idle",
  NAV_CLICK: "nav-click",
  BACK: "back",
  LEFT_BROWSER: "left-browser",
};

const KNOWN_EXIT_REASONS = new Set(Object.values(CHECKOUT_HEATMAP_EXIT_REASONS));

export function getCheckoutHeatmapInactivityMs({ automation = false, overrideMs } = {}) {
  const parsedOverride = Number(overrideMs);
  if (Number.isFinite(parsedOverride) && parsedOverride > 0) return parsedOverride;
  return automation ? CHECKOUT_HEATMAP_CONFIG.automationInactivityMs : CHECKOUT_HEATMAP_CONFIG.manualInactivityMs;
}

export function classifyCheckoutHeatmapView(viewportWidth) {
  const width = Number(viewportWidth || 0);
  return width >= CHECKOUT_HEATMAP_CONFIG.desktopBreakpointPx
    ? CHECKOUT_HEATMAP_VIEWS.DESKTOP
    : CHECKOUT_HEATMAP_VIEWS.MOBILE;
}

export function createCheckoutHeatmapSession({
  sku = null,
  step,
  viewportWidth,
  viewportHeight,
  startedAt = Date.now(),
  inactivityMs,
} = {}) {
  const width = Math.max(0, Math.round(Number(viewportWidth || 0)));
  const height = Math.max(0, Math.round(Number(viewportHeight || 0)));

  return {
    id: createId("m1_hm_session"),
    version: CHECKOUT_HEATMAP_VERSION,
    step: resolveCheckoutHeatmapStep(step),
    sku: sku ? String(sku) : null,
    view: classifyCheckoutHeatmapView(width),
    viewport: {
      width,
      height,
    },
    startedAt: toIso(startedAt),
    lastInteractionAt: toIso(startedAt),
    finalizedAt: null,
    inactivityMs: getCheckoutHeatmapInactivityMs({ overrideMs: inactivityMs }),
    interactionCount: 0,
    outcome: null,
    exitReason: null,
    events: [],
  };
}

export function createCheckoutHeatmapClick({
  x,
  y,
  type = CHECKOUT_HEATMAP_INTERACTION_TYPES.CLICK,
  timestamp = Date.now(),
  target = null,
  uiState = null,
  anchor = null,
  debug = null,
} = {}) {
  return {
    id: createId("m1_hm_click"),
    type: type === CHECKOUT_HEATMAP_INTERACTION_TYPES.TAP ? CHECKOUT_HEATMAP_INTERACTION_TYPES.TAP : CHECKOUT_HEATMAP_INTERACTION_TYPES.CLICK,
    x: Math.round(Number(x || 0)),
    y: Math.round(Number(y || 0)),
    coordinateScope: CHECKOUT_HEATMAP_COORDINATE_SCOPE,
    timestamp: toIso(timestamp),
    target: normalizeTarget(target),
    uiState: normalizeUiState(uiState),
    anchor: normalizeAnchor(anchor),
    debug: normalizeDebug(debug),
  };
}

// M4 Part 3: high-frequency movement events. Surface-relative x/y (same scope as
// clicks) so a later density/trail view can align them to the rendered step.
export function createCheckoutHeatmapMouseMove({ x, y, timestamp = Date.now() } = {}) {
  return {
    id: createId("m1_hm_event"),
    type: CHECKOUT_HEATMAP_INTERACTION_TYPES.MOUSE_MOVE,
    x: Math.round(Number(x || 0)),
    y: Math.round(Number(y || 0)),
    timestamp: toIso(timestamp),
  };
}

// M4 Part 3: scroll-depth event. `depth` is how far down the page the visitor has
// scrolled, 0-100; `scrollY` keeps the raw pixel offset for finer rendering later.
export function createCheckoutHeatmapScroll({ depth, scrollY, timestamp = Date.now() } = {}) {
  return {
    id: createId("m1_hm_event"),
    type: CHECKOUT_HEATMAP_INTERACTION_TYPES.SCROLL,
    depth: clampScrollDepth(depth),
    scrollY: Math.max(0, Math.round(Number(scrollY || 0))),
    timestamp: toIso(timestamp),
  };
}

// M4 Part 4: field interaction event (focus / blur / change). We capture only the
// behavioural signal — which field, and whether it ended up filled (+ length) —
// never the raw typed value. The integration target (Autohero) captures input
// values at its own layer, so duplicating them is out of scope and avoids PII.
export function createCheckoutHeatmapFieldEvent({ type, anchor = null, filled = false, length = 0, timestamp = Date.now() } = {}) {
  return {
    id: createId("m1_hm_event"),
    type: FIELD_EVENT_TYPES.has(type) ? type : CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_FOCUS,
    anchor: normalizeLightAnchor(anchor),
    filled: Boolean(filled),
    length: Math.max(0, Math.round(Number(length || 0))),
    timestamp: toIso(timestamp),
  };
}

// M4 Part 4: a validation error message became visible — distinct from a click on
// the error anchor. Where errors surface is itself a drop-off signal.
export function createCheckoutHeatmapValidationError({ anchor = null, timestamp = Date.now() } = {}) {
  return {
    id: createId("m1_hm_event"),
    type: CHECKOUT_HEATMAP_INTERACTION_TYPES.VALIDATION_ERROR,
    anchor: normalizeLightAnchor(anchor),
    timestamp: toIso(timestamp),
  };
}

// M4 Part 4: element entered (≥50% on screen) or left the viewport. The visible
// duration is carried on the element-hidden event (paired visible→hidden), so
// summing per anchor gives time-spent-viewing each area of the step.
export function createCheckoutHeatmapVisibility({ type, anchor = null, visibleMs, timestamp = Date.now() } = {}) {
  const event = {
    id: createId("m1_hm_event"),
    type:
      type === CHECKOUT_HEATMAP_INTERACTION_TYPES.ELEMENT_HIDDEN
        ? CHECKOUT_HEATMAP_INTERACTION_TYPES.ELEMENT_HIDDEN
        : CHECKOUT_HEATMAP_INTERACTION_TYPES.ELEMENT_VISIBLE,
    anchor: normalizeLightAnchor(anchor),
    timestamp: toIso(timestamp),
  };
  if (Number.isFinite(Number(visibleMs))) event.visibleMs = Math.max(0, Math.round(Number(visibleMs)));
  return event;
}

export function recordCheckoutHeatmapInteraction(session, { timestamp = Date.now() } = {}) {
  if (!session) return session;
  return {
    ...session,
    lastInteractionAt: toIso(timestamp),
    interactionCount: Number(session.interactionCount || 0) + 1,
  };
}

export function appendCheckoutHeatmapClick(session, click) {
  if (!session || !click) return session;
  const normalizedClick = normalizeCheckoutHeatmapClick(click);
  return {
    ...recordCheckoutHeatmapInteraction(session, { timestamp: click.timestamp || Date.now() }),
    coordinateScope: CHECKOUT_HEATMAP_COORDINATE_SCOPE,
    events: [...(Array.isArray(session.events) ? session.events : []), normalizedClick],
  };
}

// M4 Part 3: append any event type (mouse-move, scroll, …). Like a click it counts
// as a tracked interaction so the inactivity/drop-off timer treats movement and
// scrolling as activity (consistent with the M1 inactivity definition).
export function appendCheckoutHeatmapEvent(session, event) {
  if (!session || !event) return session;
  const normalizedEvent = normalizeCheckoutHeatmapEvent(event);
  return {
    ...recordCheckoutHeatmapInteraction(session, { timestamp: event.timestamp || Date.now() }),
    coordinateScope: CHECKOUT_HEATMAP_COORDINATE_SCOPE,
    events: [...(Array.isArray(session.events) ? session.events : []), normalizedEvent],
  };
}

export function isCheckoutHeatmapDropOffCandidate(session, { now = Date.now(), inactivityMs } = {}) {
  if (!session) return false;
  const events = Array.isArray(session.events) ? session.events : [];
  if (!events.some((e) => e.type === CHECKOUT_HEATMAP_INTERACTION_TYPES.CLICK || e.type === CHECKOUT_HEATMAP_INTERACTION_TYPES.TAP)) return false;

  const threshold = getCheckoutHeatmapInactivityMs({
    overrideMs: inactivityMs ?? session.inactivityMs,
  });
  const lastInteractionAt = new Date(session.lastInteractionAt || session.startedAt || 0).getTime();
  return Number.isFinite(lastInteractionAt) && Number(now) - lastInteractionAt >= threshold;
}

export function finalizeCheckoutHeatmapSession(session, { finalizedAt = Date.now(), inactivityMs, outcome, exitReason } = {}) {
  const normalized = normalizeCheckoutHeatmapSession(session);
  const threshold = getCheckoutHeatmapInactivityMs({
    overrideMs: inactivityMs ?? normalized.inactivityMs,
  });
  const finalizedIso = toIso(finalizedAt);
  const startedMs = new Date(normalized.startedAt).getTime();
  const finalizedMs = new Date(finalizedIso).getTime();
  const durationMs = Number.isFinite(startedMs) && Number.isFinite(finalizedMs) ? Math.max(0, finalizedMs - startedMs) : 0;

  const resolvedOutcome = outcome ?? normalized.outcome ?? CHECKOUT_HEATMAP_OUTCOMES.ABANDONED;
  // Exit reason describes how a visitor left a step they did NOT complete; it is
  // meaningless for advanced/completed (success) sessions. A dropped-off session
  // with no recorded signal defaults to `idle` (the catch-all per the M4 rules:
  // silence with no in-page exit — also absorbs invisible cases).
  let resolvedExitReason = exitReason ?? normalized.exitReason ?? null;
  if (resolvedOutcome === CHECKOUT_HEATMAP_OUTCOMES.ABANDONED) {
    if (!KNOWN_EXIT_REASONS.has(resolvedExitReason)) resolvedExitReason = CHECKOUT_HEATMAP_EXIT_REASONS.IDLE;
  } else {
    resolvedExitReason = null;
  }

  const { activeMs, idleMs } = computeCheckoutHeatmapStepTiming(normalized.events, { startedMs, durationMs, threshold });

  return {
    ...normalized,
    finalizedAt: finalizedIso,
    inactivityMs: threshold,
    durationMs,
    clickCount: normalized.events.filter((e) => e.type === CHECKOUT_HEATMAP_INTERACTION_TYPES.CLICK || e.type === CHECKOUT_HEATMAP_INTERACTION_TYPES.TAP).length,
    outcome: resolvedOutcome,
    exitReason: resolvedExitReason,
    stepActiveMs: activeMs,
    stepIdleMs: idleMs,
  };
}

// M4 Part 5 — split a step visit into active vs idle time. Each gap between
// consecutive events (and from session start to the first event) counts as
// active up to the inactivity threshold; anything beyond is idle (e.g. the
// trailing silence that triggers a drop-off). By construction active + idle =
// duration, so the two always reconcile.
export function computeCheckoutHeatmapStepTiming(events, { startedMs, durationMs, threshold }) {
  if (!Number.isFinite(startedMs) || !Number.isFinite(durationMs) || durationMs <= 0) {
    return { activeMs: 0, idleMs: Math.max(0, Math.round(durationMs || 0)) };
  }
  const timestamps = (Array.isArray(events) ? events : [])
    .map((e) => new Date(e.timestamp).getTime())
    .filter((t) => Number.isFinite(t) && t >= startedMs)
    .sort((a, b) => a - b);

  let active = 0;
  let prev = startedMs;
  for (const t of timestamps) {
    active += Math.min(Math.max(0, t - prev), threshold);
    prev = t;
  }
  active = Math.min(Math.round(active), durationMs);
  return { activeMs: active, idleMs: Math.max(0, durationMs - active) };
}

export function normalizeCheckoutHeatmapSession(session) {
  const source = session && typeof session === "object" ? session : {};
  const viewport = source.viewport && typeof source.viewport === "object" ? source.viewport : {};
  const width = Math.max(0, Math.round(Number(viewport.width || source.viewportWidth || 0)));
  const height = Math.max(0, Math.round(Number(viewport.height || source.viewportHeight || 0)));
  const startedAt = toIso(source.startedAt || Date.now());

  return {
    id: source.id ? String(source.id) : createId("m1_hm_session"),
    version: Number(source.version || CHECKOUT_HEATMAP_VERSION),
    step: resolveCheckoutHeatmapStep(source.step),
    sku: source.sku ? String(source.sku) : null,
    view: isKnownView(source.view) ? source.view : classifyCheckoutHeatmapView(width),
    viewport: {
      width,
      height,
    },
    startedAt,
    lastInteractionAt: toIso(source.lastInteractionAt || startedAt),
    finalizedAt: source.finalizedAt ? toIso(source.finalizedAt) : null,
    coordinateScope: source.coordinateScope ? String(source.coordinateScope) : null,
    inactivityMs: getCheckoutHeatmapInactivityMs({ overrideMs: source.inactivityMs }),
    durationMs: Number.isFinite(Number(source.durationMs)) ? Math.max(0, Number(source.durationMs)) : undefined,
    clickCount: Number.isFinite(Number(source.clickCount)) ? Math.max(0, Number(source.clickCount)) : undefined,
    interactionCount: Number.isFinite(Number(source.interactionCount)) ? Math.max(0, Number(source.interactionCount)) : 0,
    outcome: source.outcome != null ? String(source.outcome) : null,
    exitReason: KNOWN_EXIT_REASONS.has(source.exitReason) ? source.exitReason : null,
    stepActiveMs: Number.isFinite(Number(source.stepActiveMs)) ? Math.max(0, Math.round(Number(source.stepActiveMs))) : undefined,
    stepIdleMs: Number.isFinite(Number(source.stepIdleMs)) ? Math.max(0, Math.round(Number(source.stepIdleMs))) : undefined,
    samplingRate: Number.isFinite(Number(source.samplingRate)) ? Number(source.samplingRate) : 1,
    events: (Array.isArray(source.events) ? source.events : Array.isArray(source.clicks) ? source.clicks : []).map(normalizeCheckoutHeatmapEvent),
  };
}

export function aggregateCheckoutHeatmapClicks(sessions, { view, step } = {}) {
  const buckets = new Map();

  for (const session of Array.isArray(sessions) ? sessions : []) {
    const normalizedSession = normalizeCheckoutHeatmapSession(session);
    if (view && normalizedSession.view !== view) continue;
    if (step && normalizedSession.step !== step) continue;

    for (const click of normalizedSession.events.filter((e) => e.type === CHECKOUT_HEATMAP_INTERACTION_TYPES.CLICK || e.type === CHECKOUT_HEATMAP_INTERACTION_TYPES.TAP)) {
      const key = `${click.x}:${click.y}`;
      const current = buckets.get(key) || {
        x: click.x,
        y: click.y,
        count: 0,
        view: normalizedSession.view,
        sessionIds: [],
      };
      current.count += 1;
      if (!current.sessionIds.includes(normalizedSession.id)) current.sessionIds.push(normalizedSession.id);
      buckets.set(key, current);
    }
  }

  const points = Array.from(buckets.values());
  const maxCount = points.reduce((max, point) => Math.max(max, point.count), 0);

  return points.map((point) => ({
    ...point,
    radius: scaleCheckoutHeatmapRadius(point.count, maxCount),
  }));
}

export function scaleCheckoutHeatmapRadius(count, maxCount) {
  const min = CHECKOUT_HEATMAP_CONFIG.minRadiusPx;
  const max = CHECKOUT_HEATMAP_CONFIG.maxRadiusPx;
  const safeCount = Math.max(1, Number(count || 1));
  const safeMax = Math.max(safeCount, Number(maxCount || safeCount));

  if (safeMax <= 1) return min;

  const proportionalRadius = max * (safeCount / safeMax);
  const boundedRadius = Math.min(max, Math.max(min, proportionalRadius));
  return Math.round(boundedRadius * 100) / 100;
}

// M4 Part 3: events are polymorphic. Click/tap keep the rich M1/M2 click shape;
// the high-frequency types carry only their own minimal payload. Anything
// unrecognised (or legacy untyped) degrades to a click, as before.
function normalizeCheckoutHeatmapEvent(event) {
  const source = event && typeof event === "object" ? event : {};
  switch (source.type) {
    case CHECKOUT_HEATMAP_INTERACTION_TYPES.MOUSE_MOVE:
      return {
        id: source.id ? String(source.id) : createId("m1_hm_event"),
        type: CHECKOUT_HEATMAP_INTERACTION_TYPES.MOUSE_MOVE,
        x: Math.round(Number(source.x || 0)),
        y: Math.round(Number(source.y || 0)),
        timestamp: toIso(source.timestamp || Date.now()),
      };
    case CHECKOUT_HEATMAP_INTERACTION_TYPES.SCROLL:
      return {
        id: source.id ? String(source.id) : createId("m1_hm_event"),
        type: CHECKOUT_HEATMAP_INTERACTION_TYPES.SCROLL,
        depth: clampScrollDepth(source.depth),
        scrollY: Math.max(0, Math.round(Number(source.scrollY || 0))),
        timestamp: toIso(source.timestamp || Date.now()),
      };
    // M4 Part 4 — field events carry the field anchor + a filled/length signal
    // (never the raw value).
    case CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_FOCUS:
    case CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_BLUR:
    case CHECKOUT_HEATMAP_INTERACTION_TYPES.FIELD_CHANGE:
      return {
        id: source.id ? String(source.id) : createId("m1_hm_event"),
        type: source.type,
        anchor: normalizeLightAnchor(source.anchor),
        filled: Boolean(source.filled),
        length: Math.max(0, Math.round(Number(source.length || 0))),
        timestamp: toIso(source.timestamp || Date.now()),
      };
    case CHECKOUT_HEATMAP_INTERACTION_TYPES.VALIDATION_ERROR:
      return {
        id: source.id ? String(source.id) : createId("m1_hm_event"),
        type: CHECKOUT_HEATMAP_INTERACTION_TYPES.VALIDATION_ERROR,
        anchor: normalizeLightAnchor(source.anchor),
        timestamp: toIso(source.timestamp || Date.now()),
      };
    // M4 Part 4 — element visibility; `visibleMs` (present on element-hidden) is
    // the time the element stayed ≥50% on screen.
    case CHECKOUT_HEATMAP_INTERACTION_TYPES.ELEMENT_VISIBLE:
    case CHECKOUT_HEATMAP_INTERACTION_TYPES.ELEMENT_HIDDEN: {
      const event = {
        id: source.id ? String(source.id) : createId("m1_hm_event"),
        type: source.type,
        anchor: normalizeLightAnchor(source.anchor),
        timestamp: toIso(source.timestamp || Date.now()),
      };
      if (Number.isFinite(Number(source.visibleMs))) event.visibleMs = Math.max(0, Math.round(Number(source.visibleMs)));
      return event;
    }
    default:
      return normalizeCheckoutHeatmapClick(source);
  }
}

// A minimal anchor for non-positional events (field / validation / visibility):
// the stable anchor id + its scanner-resolved type. No dx/dy — these events are
// element-level, not pixel-level.
function normalizeLightAnchor(anchor) {
  if (!anchor || typeof anchor !== "object") return null;
  const id = anchor.id ? String(anchor.id).slice(0, 120) : null;
  if (!id) return null;
  const normalized = { id };
  if (anchor.type) normalized.type = String(anchor.type).slice(0, 40);
  return normalized;
}

function clampScrollDepth(value) {
  const depth = Math.round(Number(value || 0));
  if (!Number.isFinite(depth)) return 0;
  return Math.min(100, Math.max(0, depth));
}

function normalizeCheckoutHeatmapClick(click) {
  const source = click && typeof click === "object" ? click : {};

  return {
    id: source.id ? String(source.id) : createId("m1_hm_click"),
    type: source.type === CHECKOUT_HEATMAP_INTERACTION_TYPES.TAP ? CHECKOUT_HEATMAP_INTERACTION_TYPES.TAP : CHECKOUT_HEATMAP_INTERACTION_TYPES.CLICK,
    x: Math.round(Number(source.x || 0)),
    y: Math.round(Number(source.y || 0)),
    coordinateScope: source.coordinateScope ? String(source.coordinateScope) : null,
    timestamp: toIso(source.timestamp || Date.now()),
    target: normalizeTarget(source.target),
    uiState: normalizeUiState(source.uiState),
    anchor: normalizeAnchor(source.anchor),
    debug: normalizeDebug(source.debug),
  };
}

function normalizeAnchor(anchor) {
  if (!anchor || typeof anchor !== "object") return null;
  const id = anchor.id ? String(anchor.id).slice(0, 120) : null;
  if (!id) return null;
  const normalized = {
    id,
    dx: Math.round(Number(anchor.dx || 0)),
    dy: Math.round(Number(anchor.dy || 0)),
  };
  // M2: anchors carry the scanner-resolved element type (e.g. "toggle",
  // "display", "error") alongside the id. Optional for back-compat with M1 data.
  if (anchor.type) normalized.type = String(anchor.type).slice(0, 40);
  return normalized;
}

function normalizeTarget(target) {
  if (!target || typeof target !== "object") return null;

  const normalized = {
    tagName: target.tagName ? String(target.tagName).slice(0, 40) : null,
    role: target.role ? String(target.role).slice(0, 80) : null,
    label: target.label ? String(target.label).slice(0, 160) : null,
    name: target.name ? String(target.name).slice(0, 160) : null,
    anchor: target.anchor ? normalizeTarget(target.anchor) : null,
  };

  const offsetX = Number(target.offsetX);
  const offsetY = Number(target.offsetY);
  if (Number.isFinite(offsetX)) normalized.offsetX = Math.round(offsetX * 100) / 100;
  if (Number.isFinite(offsetY)) normalized.offsetY = Math.round(offsetY * 100) / 100;

  return normalized;
}

function normalizeUiState(uiState) {
  if (!uiState || typeof uiState !== "object") return null;

  return {
    validationVisible: Boolean(uiState.validationVisible),
    validationYShift: Math.round(Math.max(0, Number(uiState.validationYShift || 0))),
    openAccordions: Array.isArray(uiState.openAccordions)
      ? uiState.openAccordions.map((value) => String(value).slice(0, 120))
      : [],
  };
}

function normalizeDebug(debug) {
  if (!debug || typeof debug !== "object") return null;

  const numericFields = [
    "clientX",
    "clientY",
    "pageX",
    "pageY",
    "scrollX",
    "scrollY",
    "surfaceLeft",
    "surfaceTop",
    "surfacePageLeft",
    "surfacePageTop",
    "surfaceWidth",
    "surfaceHeight",
    "calculatedX",
    "calculatedY",
  ];
  const result = {};

  for (const field of numericFields) {
    const value = Number(debug[field]);
    if (Number.isFinite(value)) result[field] = Math.round(value * 100) / 100;
  }

  if (debug.surfaceName) result.surfaceName = String(debug.surfaceName).slice(0, 80);
  return Object.keys(result).length ? result : null;
}

function isKnownView(view) {
  return view === CHECKOUT_HEATMAP_VIEWS.DESKTOP || view === CHECKOUT_HEATMAP_VIEWS.MOBILE;
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function createId(prefix) {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}
