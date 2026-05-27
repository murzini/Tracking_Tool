import { randomUUID } from "crypto";
import { CHECKOUT_ELEMENT_REGISTRY } from "./checkoutHeatmapRegistry";

// Personal-information anchors (tagged, not removed) — the only step simulated.
const PI_ANCHORS = CHECKOUT_ELEMENT_REGISTRY
  .filter((e) => e.removedAt === null && e.steps.includes("personal-info"))
  .map((e) => e.id);

const TOTAL_SESSIONS = 1500;
const DESKTOP_RATIO = 0.6;    // ~60% desktop, ~40% mobile
const ABANDONED_RATIO = 0.65; // ~65% abandoned, ~35% completed
const WINDOW_DAYS = 30;

const EXIT_REASON_WEIGHTS = [
  { reason: "idle",         weight: 0.50 },
  { reason: "left-browser", weight: 0.30 },
  { reason: "nav-click",    weight: 0.15 },
  { reason: "back",         weight: 0.05 },
];

function ri(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pickWeighted(items) {
  let r = Math.random() * items.reduce((s, i) => s + i.weight, 0);
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function genId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function genClicks(count, anchors, baseTs) {
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push({
      id: genId("sim_ev"),
      type: "click",
      anchor: {
        id: anchors[ri(0, anchors.length - 1)],
        dx: ri(-8, 8),
        dy: ri(-8, 8),
      },
      x: ri(20, 580),
      y: ri(80, 2400),
      coordinateScope: "shop-content-v4",
      timestamp: iso(baseTs + i * ri(400, 800)),
    });
  }
  return events;
}

function genMoves(count, maxX, maxY, baseTs) {
  const events = [];
  let x = ri(50, maxX - 50);
  let y = ri(50, 400);
  for (let i = 0; i < count; i++) {
    x = Math.max(10, Math.min(maxX - 10, x + ri(-50, 50)));
    y = Math.max(10, Math.min(maxY - 10, y + ri(-40, 40)));
    events.push({
      id: genId("sim_ev"),
      type: "mouse-move",
      x: Math.round(x),
      y: Math.round(y),
      timestamp: iso(baseTs + i * 100 + ri(0, 40)),
    });
  }
  return events;
}

function genScrolls(count, baseTs) {
  const events = [];
  let depth = 0;
  for (let i = 0; i < count; i++) {
    depth = Math.min(100, depth + ri(4, 18));
    events.push({
      id: genId("sim_ev"),
      type: "scroll",
      depth,
      scrollY: Math.round(depth * 25),
      timestamp: iso(baseTs + i * ri(150, 400)),
    });
  }
  return events;
}

// Returns an array of ~1500 pre-finalized synthetic session objects.
// All sessions target step=personal-info. No DB access here — the caller
// passes the result to bulkInsertCheckoutHeatmapSessions.
export function generateSimulatedSessions({ count = TOTAL_SESSIONS } = {}) {
  const now = Date.now();
  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const sessions = [];

  for (let i = 0; i < count; i++) {
    const isDesktop = Math.random() < DESKTOP_RATIO;
    const vpWidth   = isDesktop ? ri(1024, 1920) : ri(360, 430);
    const vpHeight  = isDesktop ? ri(768, 1080)  : ri(667, 932);
    const view      = isDesktop ? "desktop_view" : "mobile_view";

    const startedAt   = now - ri(0, windowMs);
    const durationMs  = ri(8000, 180000);
    const finalizedAt = startedAt + durationMs;

    const isAbandoned = Math.random() < ABANDONED_RATIO;
    const outcome     = isAbandoned ? "abandoned" : "completed";
    const exitReason  = isAbandoned ? pickWeighted(EXIT_REASON_WEIGHTS).reason : null;

    const clickCount = ri(3, 14);
    const moveCount  = isDesktop ? ri(20, 70) : ri(8, 35);
    const scrollCount = ri(4, 18);

    // Spread event starts across the session
    const clickTs  = startedAt + ri(500, Math.floor(durationMs * 0.25));
    const moveTs   = startedAt + ri(300, Math.floor(durationMs * 0.4));
    const scrollTs = startedAt + ri(400, Math.floor(durationMs * 0.35));

    const maxX = isDesktop ? 620 : vpWidth - 10;
    const maxY = isDesktop ? 2500 : 3500;

    const events = [
      ...genClicks(clickCount, PI_ANCHORS, clickTs),
      ...genMoves(moveCount, maxX, maxY, moveTs),
      ...genScrolls(scrollCount, scrollTs),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const activeMs = Math.round(durationMs * ri(50, 70) / 100);

    sessions.push({
      id: genId("sim_sess"),
      version: 1,
      step: "personal-info",
      sku: "001",
      view,
      viewport: { width: vpWidth, height: vpHeight },
      startedAt: iso(startedAt),
      lastInteractionAt: iso(finalizedAt - ri(0, 3000)),
      finalizedAt: iso(finalizedAt),
      coordinateScope: "shop-content-v4",
      inactivityMs: 30000,
      durationMs,
      clickCount,
      interactionCount: clickCount + scrollCount,
      outcome,
      exitReason,
      samplingRate: 1,
      stepActiveMs: activeMs,
      stepIdleMs: durationMs - activeMs,
      visitorId: null,
      events,
    });
  }

  return sessions;
}
