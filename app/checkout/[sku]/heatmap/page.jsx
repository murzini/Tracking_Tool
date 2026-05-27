"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckoutFlow } from "../../../../components/prototype/CheckoutFlow";
import { ShopFrame, useCatalogItem } from "../../../../components/prototype/shopRuntime";
import {
  CHECKOUT_HEATMAP_CONFIG,
  CHECKOUT_HEATMAP_VIEWS,
  normalizeCheckoutHeatmapSession,
  resolveCheckoutHeatmapStep,
  scaleCheckoutHeatmapRadius,
} from "../../../../lib/prototype/checkoutHeatmap";
import { buildAnchorIndex } from "../../../../lib/prototype/checkoutScanner";

const STEP_LABELS = {
  "personal-info": "Personal Information",
  delivery: "Choose Delivery",
  pay: "Pay & Finish",
};

export default function CheckoutHeatmapPage() {
  return (
    <Suspense fallback={<HeatmapFallback />}>
      <CheckoutHeatmapContent />
    </Suspense>
  );
}

function CheckoutHeatmapContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sku = Array.isArray(params?.sku) ? params.sku[0] : params?.sku || "001";
  const selectedView = readView(searchParams.get("view"));
  const selectedStep = resolveCheckoutHeatmapStep(searchParams.get("step"));
  // `type` switches the active overlay: clicks (default) / mouse moves / scrolls.
  // Each type has a single style now, so a URL with no `type` renders clicks and
  // the click-precision tests stay valid.
  const selectedType = readLayerType(searchParams.get("type"));
  // M6 P5 — outcome filter and view-window timeframe from the dashboard.
  const selectedOutcome = readOutcome(searchParams.get("outcome"));
  const selectedFrom = searchParams.get("from") ?? "";
  const selectedTo = searchParams.get("to") ?? "";
  const { item, loading: itemLoading } = useCatalogItem(sku);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState([]);
  const [fixedPoints, setFixedPoints] = useState([]);

  useEffect(() => {
    let alive = true;
    let intervalId = null;

    const loadSessions = async ({ initial = false } = {}) => {
      if (initial) setLoading(true);
      try {
        const res = await fetch("/api/checkout-heatmap", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        const nextSessions = Array.isArray(data?.sessions) ? data.sessions.map(normalizeCheckoutHeatmapSession) : [];
        setSessions((currentSessions) => {
          const currentSignature = getSessionsSignature(currentSessions);
          const nextSignature = getSessionsSignature(nextSessions);
          if (nextSessions.length > 0 && intervalId) {
            window.clearInterval(intervalId);
            intervalId = null;
          }
          return currentSignature === nextSignature ? currentSessions : nextSessions;
        });
      } catch {
        // Polling is best-effort; a missed request must not crash the heatmap page.
      } finally {
        if (alive && initial) setLoading(false);
      }
    };

    loadSessions({ initial: true });
    intervalId = window.setInterval(() => {
      loadSessions();
    }, 3000);
    return () => {
      alive = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const viewSessions = useMemo(() => {
    let filtered = sessions.filter(
      (session) => session.view === selectedView && session.step === selectedStep
    );
    if (selectedOutcome === "drop-offs") {
      filtered = filtered.filter((s) => s.outcome === "abandoned");
    } else if (selectedOutcome === "completers") {
      filtered = filtered.filter((s) => s.outcome === "completed");
    }
    if (selectedFrom) {
      const fromMs = new Date(selectedFrom + "T00:00:00.000").getTime();
      filtered = filtered.filter((s) => new Date(s.startedAt).getTime() >= fromMs);
    }
    if (selectedTo) {
      const toMs = new Date(selectedTo + "T23:59:59.999").getTime();
      filtered = filtered.filter((s) => new Date(s.startedAt).getTime() <= toMs);
    }
    return filtered;
  }, [selectedView, selectedStep, selectedOutcome, selectedFrom, selectedTo, sessions]);

  // M4 Part 6 — mouse-move data. Surface-relative x/y (captured against the same
  // shop-content surface), so they align to the overlay without anchor resolution.
  const movePoints = useMemo(() => {
    const pts = [];
    for (const session of viewSessions) {
      for (const event of session.events || []) {
        if (event.type === "mouse-move") pts.push({ x: event.x, y: event.y });
      }
    }
    return pts;
  }, [viewSessions]);

  // One ordered path per session for the trails view.
  const moveTrails = useMemo(() => {
    return viewSessions
      .map((session) =>
        (session.events || [])
          .filter((event) => event.type === "mouse-move")
          .slice()
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map((event) => ({ x: event.x, y: event.y }))
      )
      .filter((trail) => trail.length >= 2);
  }, [viewSessions]);

  // Scroll reach: per session keep the deepest depth reached, then build a
  // top→bottom reach gradient (how many sessions reached each depth band).
  const scrollStats = useMemo(() => {
    const maxDepths = [];
    for (const session of viewSessions) {
      const depths = (session.events || []).filter((e) => e.type === "scroll").map((e) => e.depth);
      if (depths.length) maxDepths.push(Math.max(...depths));
    }
    const bands = [];
    for (let depth = 0; depth <= 100; depth += 10) {
      const reached = maxDepths.filter((m) => m >= depth).length;
      bands.push({ depth, fraction: maxDepths.length ? reached / maxDepths.length : 0 });
    }
    // Green translucent tint (alpha scales with the % of sessions reaching each
    // depth) so the step shows through — not multiply, which crushed the content.
    const gradient = `linear-gradient(to bottom, ${bands
      .map((b) => `rgba(22,163,74,${(0.55 * b.fraction).toFixed(3)}) ${b.depth}%`)
      .join(", ")})`;
    return { gradient, bands, sessionsWithScroll: maxDepths.length };
  }, [viewSessions]);

  const overlay = useMemo(() => {
    if (selectedType === "moves") return <MouseMoveTrailsOverlay trails={moveTrails} />;
    if (selectedType === "scrolls") {
      return <ScrollGradientOverlay gradient={scrollStats.gradient} bands={scrollStats.bands} hasData={scrollStats.sessionsWithScroll > 0} />;
    }
    return null;
  }, [selectedType, moveTrails, scrollStats]);

  const layerCountLabel =
    selectedType === "moves"
      ? `${movePoints.length} moves`
      : selectedType === "scrolls"
      ? `${scrollStats.sessionsWithScroll} scroll sessions`
      : `${points.length + fixedPoints.length} hotspots`;

  useEffect(() => {
    if (itemLoading) return;

    let raf = null;
    const recalculate = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const { surface: nextPoints, fixed: nextFixedPoints } = buildAnchorAwarePoints(viewSessions);
        setPoints((cur) => getPointsSignature(cur) === getPointsSignature(nextPoints) ? cur : nextPoints);
        setFixedPoints((cur) => getPointsSignature(cur) === getPointsSignature(nextFixedPoints) ? cur : nextFixedPoints);
      });
    };

    recalculate();
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [itemLoading, viewSessions]);

  const isMobileView = selectedView === CHECKOUT_HEATMAP_VIEWS.MOBILE;

  const mobileViewportWidth = useMemo(() => {
    if (!isMobileView || !viewSessions.length) return CHECKOUT_HEATMAP_CONFIG.mobileViewportWidthPx;
    const counts = new Map();
    for (const session of viewSessions) {
      const w = session.viewport?.width;
      if (w > 0) counts.set(w, (counts.get(w) || 0) + 1);
    }
    if (!counts.size) return CHECKOUT_HEATMAP_CONFIG.mobileViewportWidthPx;
    let maxCount = 0;
    let modeWidth = CHECKOUT_HEATMAP_CONFIG.mobileViewportWidthPx;
    for (const [w, count] of counts) {
      if (count > maxCount) { maxCount = count; modeWidth = w; }
    }
    return modeWidth;
  }, [isMobileView, viewSessions]);

  const forcedWidth = isMobileView ? mobileViewportWidth : null;

  useEffect(() => {
    if (!isMobileView) return;
    const style = document.createElement("style");
    style.id = "m1-mobile-heatmap-overrides";
    style.textContent = `
      [data-checkout-heatmap-surface="shop-frame"] {
        overflow-x: clip !important;
      }
      [data-heatmap-id="icon:chatbot"] {
        will-change: transform;
      }
      [data-checkout-heatmap-surface="shop-content"] {
        width: ${mobileViewportWidth}px !important;
        max-width: 100% !important;
      }
      @media (min-width: 768px) {
        [data-checkout-heatmap-surface="shop-content"] [class*="md:grid-cols-"] {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        [data-checkout-heatmap-surface="shop-content"] .grid-cols-2[class*="md:grid-cols-"] {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }
      @media (min-width: 1024px) {
        [data-checkout-heatmap-surface="shop-content"] [class*="lg:grid-cols-"] {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        [data-checkout-heatmap-surface="shop-content"] [class*="lg:col-span-"] {
          grid-column: span 1 / span 1 !important;
        }
        [data-checkout-heatmap-surface="shop-content"] .hidden[class*="lg:block"] {
          display: none !important;
        }
        [data-checkout-heatmap-surface="shop-content"] [class*="lg:hidden"] {
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("m1-mobile-heatmap-overrides")?.remove(); };
  }, [isMobileView, mobileViewportWidth]);

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-[#111827]">
      <div className="sticky top-0 z-[60] border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{STEP_LABELS[selectedStep]} heatmap</h1>
              <div className="mt-1 text-xs text-slate-500" data-heatmap-stats>
                {selectedView} - <span data-heatmap-session-count>{viewSessions.length}</span> sessions - {layerCountLabel}
                {selectedType === "clicks"
                  ? ` - radius ${CHECKOUT_HEATMAP_CONFIG.minRadiusPx}px-${CHECKOUT_HEATMAP_CONFIG.maxRadiusPx}px`
                  : ""}
                {isMobileView ? ` - ${mobileViewportWidth}px viewport` : ""}
                {loading ? " - loading" : ""}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <ViewLink sku={sku} step={selectedStep} view={CHECKOUT_HEATMAP_VIEWS.DESKTOP} selectedView={selectedView} type={selectedType} outcome={selectedOutcome} from={selectedFrom} to={selectedTo}>
                  Desktop
                </ViewLink>
                <ViewLink sku={sku} step={selectedStep} view={CHECKOUT_HEATMAP_VIEWS.MOBILE} selectedView={selectedView} type={selectedType} outcome={selectedOutcome} from={selectedFrom} to={selectedTo}>
                  Mobile
                </ViewLink>
              </div>

              <div className="flex flex-wrap items-center gap-2" data-heatmap-type-toggle>
                <TypeLink sku={sku} step={selectedStep} view={selectedView} type="clicks" selectedType={selectedType} outcome={selectedOutcome} from={selectedFrom} to={selectedTo}>
                  See clicks
                </TypeLink>
                <TypeLink sku={sku} step={selectedStep} view={selectedView} type="moves" selectedType={selectedType} outcome={selectedOutcome} from={selectedFrom} to={selectedTo}>
                  See mouse moves
                </TypeLink>
                <TypeLink sku={sku} step={selectedStep} view={selectedView} type="scrolls" selectedType={selectedType} outcome={selectedOutcome} from={selectedFrom} to={selectedTo}>
                  See scrolls
                </TypeLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ShopFrame
        showChat
        heatmapPoints={selectedType === "clicks" ? points : null}
        overlay={overlay}
        topBarNote={selectedType === "moves" ? <MovesNote isMobileView={isMobileView} /> : null}
        forcedWidth={forcedWidth}
      >
        <div className="pointer-events-none">
          {itemLoading ? (
            <div className="py-24 text-sm text-muted-foreground">Loading checkout preview...</div>
          ) : !item ? (
            <div className="py-24 text-sm text-muted-foreground">Product not found.</div>
          ) : (
            <CheckoutFlow
              item={item}
              step={selectedStep}
              setStep={() => {}}
              onBackToDetails={() => {}}
              onFinish={() => {}}
              heatmapMode={true}
              forceExpandedLayout={selectedType === "clicks"}
              showPersonalInfoValidation={selectedStep === "personal-info" && selectedType === "clicks"}
            />
          )}
        </div>
      </ShopFrame>

      {(selectedType === "clicks" ? fixedPoints : []).map((point) => (
        <div
          key={`fixed:${point.right}:${point.bottom}`}
          title={`${point.count} click${point.count === 1 ? "" : "s"}`}
          className="pointer-events-none rounded-full border border-red-700/80 shadow-[0_0_0_2px_rgba(239,68,68,0.18)]"
          style={{
            position: "fixed",
            right: point.right - point.radius,
            bottom: point.bottom - point.radius,
            width: point.radius * 2,
            height: point.radius * 2,
            backgroundColor: `rgba(239,68,68,${point.alpha})`,
            zIndex: 9999,
          }}
        />
      ))}
    </main>
  );
}

// Moves-view note shown in the shop top bar (right of the logo), explaining that
// trails near the floating chat/summary are approximate. Mobile additionally
// carries the finger-movement disclaimer, stacked above; mobile float wording
// drops "right side" (mobile has no fixed sidebar).
const MOVES_FINGER_NOTE =
  "On mobile there's no mouse — here you see finger movements that include scrolling. See details for scrolling on a separate view.";
const MOVES_FLOAT_NOTE_DESKTOP = "Summary & chat float on screen, so right-side trails are approximate.";
const MOVES_FLOAT_NOTE_MOBILE = "Chat floats on screen, so trails near it are approximate.";

function MovesNote({ isMobileView }) {
  return (
    <div
      data-heatmap-moves-note
      className="rounded-md bg-amber-100/90 px-2 py-1 text-[8px] font-medium leading-snug text-amber-900 ring-1 ring-amber-300/60 sm:max-w-[260px]"
    >
      {isMobileView ? (
        <span data-heatmap-mobile-moves-disclaimer>{MOVES_FINGER_NOTE}</span>
      ) : null}
      {isMobileView ? <span className="mx-1">·</span> : null}
      <span data-heatmap-floating-trails-note>
        {isMobileView ? MOVES_FLOAT_NOTE_MOBILE : MOVES_FLOAT_NOTE_DESKTOP}
      </span>
    </div>
  );
}

function toggleClassName(active) {
  return [
    "inline-flex h-10 items-center rounded-2xl border px-3 text-xs font-semibold shadow-sm",
    active ? "border-[#0B1A33] bg-[#0B1A33] text-white" : "bg-white text-slate-800 hover:bg-slate-50",
  ].join(" ");
}

function ViewLink({ sku, step, view, selectedView, type, outcome, from, to, children }) {
  const active = view === selectedView;
  return (
    <a href={buildHeatmapHref({ sku, step, view, type, outcome, from, to })} className={toggleClassName(active)}>
      {children}
    </a>
  );
}

function TypeLink({ sku, step, view, type, selectedType, outcome, from, to, children }) {
  const active = type === selectedType;
  return (
    <a href={buildHeatmapHref({ sku, step, view, type, outcome, from, to })} className={toggleClassName(active)} data-heatmap-type={type}>
      {children}
    </a>
  );
}

// `type` rides in the URL alongside step/view. Clicks (the default) emits no
// `type` param, so a bare heatmap URL renders the click view. M6 P5 adds
// `outcome` and timeframe `from`/`to` so toggling view/type preserves filters.
function buildHeatmapHref({ sku, step, view, type, outcome, from, to }) {
  const params = new URLSearchParams();
  params.set("step", step);
  params.set("view", view);
  if (type === "moves" || type === "scrolls") params.set("type", type);
  if (outcome && outcome !== "all") params.set("outcome", outcome);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return `/checkout/${encodeURIComponent(sku)}/heatmap?${params.toString()}`;
}

function readView(value) {
  if (value === CHECKOUT_HEATMAP_VIEWS.MOBILE) return CHECKOUT_HEATMAP_VIEWS.MOBILE;
  return CHECKOUT_HEATMAP_VIEWS.DESKTOP;
}

function readLayerType(value) {
  return value === "moves" || value === "scrolls" ? value : "clicks";
}

function readOutcome(value) {
  if (value === "drop-offs" || value === "completers") return value;
  return "all";
}

// ─── Heatmap overlays ─────────────────────────────────────────────────────────
// Both render inside the relative shop-content surface (via ShopFrame's overlay
// slot), so positions map directly to the rendered step.

// Stroke alpha is volume-aware: a fixed 0.5 stacks into a solid mass at high
// session counts (the form disappears), so alpha falls toward ~0.06 at ~1000
// trails while staying visible for a handful of sessions.
function trailStrokeAlpha(trailCount) {
  if (trailCount <= 0) return 0.5;
  return Math.min(0.5, Math.max(0.04, 60 / trailCount));
}

function MouseMoveTrailsOverlay({ trails }) {
  const stroke = `rgba(37,99,235,${trailStrokeAlpha(trails.length)})`;
  return (
    <svg
      data-heatmap-layer="mouse-moves"
      data-heatmap-style="trails"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
    >
      {trails.map((trail, i) => (
        <polyline
          key={i}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
        />
      ))}
    </svg>
  );
}

function ScrollGradientOverlay({ gradient, bands, hasData }) {
  // Inline legend: one "<n>% saw it" label at each depth where the reach %
  // changes (dedupe consecutive equal values, skip empty bands) so the labels
  // mark where viewership steps down rather than repeating.
  const labels = [];
  let prevPct = null;
  for (const band of bands || []) {
    if (band.fraction <= 0) continue;
    const pct = Math.round(band.fraction * 100);
    if (pct === prevPct) continue;
    labels.push({ depth: band.depth, pct });
    prevPct = pct;
  }
  return (
    <div
      data-heatmap-layer="scrolls"
      data-heatmap-style="gradient"
      data-heatmap-has-data={hasData ? "true" : "false"}
      className="absolute inset-0"
      style={{ background: gradient }}
    >
      {labels.map((label) => (
        <div
          key={label.depth}
          data-heatmap-scroll-legend
          className="absolute left-1 text-[10px] font-semibold text-green-900"
          style={{ top: `calc(${label.depth}% + 1px)` }}
        >
          <span className="rounded bg-white/70 px-1">{label.pct}% saw it</span>
        </div>
      ))}
    </div>
  );
}

// M4 Part 8: click dots encode count by opacity — busier spots render more
// solid. Positions and radius are unchanged, so the click-precision tests stay
// valid; only the red alpha varies with count/maxCount.
const CLICK_DOT_MIN_ALPHA = 0.2;
const CLICK_DOT_MAX_ALPHA = 0.8;
function clickDotAlpha(count, maxCount) {
  const t = maxCount > 0 ? count / maxCount : 0;
  return CLICK_DOT_MIN_ALPHA + (CLICK_DOT_MAX_ALPHA - CLICK_DOT_MIN_ALPHA) * t;
}

function buildAnchorAwarePoints(sessions) {
  const surfaceBuckets = new Map();
  const fixedBuckets = new Map();

  // Re-run the scanner once over the rendered step so anchors with no
  // data-heatmap-id (auto-discovered controls, validation error messages) can be
  // resolved back to their element. Scope to the shop frame so the heatmap page's
  // own header chrome is excluded from discovery.
  const scanRoot =
    document.querySelector('[data-checkout-heatmap-surface="shop-frame"]') || document;
  const anchorIndex = buildAnchorIndex(scanRoot);

  for (const session of sessions) {
    for (const click of (Array.isArray(session.events) ? session.events : []).filter((e) => e.type === "click" || e.type === "tap")) {
      const point = resolveAnchorPoint(click, anchorIndex);
      if (!point) continue;
      const buckets = point.fixed ? fixedBuckets : surfaceBuckets;
      const key = `${point.x}:${point.y}`;
      const current = buckets.get(key) || { x: point.x, y: point.y, right: point.right, bottom: point.bottom, count: 0, sessionIds: [], fixed: point.fixed };
      current.count += 1;
      if (!current.sessionIds.includes(session.id)) current.sessionIds.push(session.id);
      buckets.set(key, current);
    }
  }

  const scaleGroup = (buckets, maxCount) => {
    return Array.from(buckets.values()).map((p) => ({
      ...p,
      radius: scaleCheckoutHeatmapRadius(p.count, maxCount),
      alpha: clickDotAlpha(p.count, maxCount),
    }));
  };

  // One shared scale for the whole step: size and opacity are relative to the
  // busiest dot anywhere on screen (surface + fixed together), so a dot with more
  // clicks always reads hotter than one with fewer — across both groups.
  const maxCount = [...surfaceBuckets.values(), ...fixedBuckets.values()].reduce(
    (max, p) => Math.max(max, p.count),
    0
  );

  return { surface: scaleGroup(surfaceBuckets, maxCount), fixed: scaleGroup(fixedBuckets, maxCount) };
}

function resolveAnchorPoint(click, anchorIndex) {
  const anchor = click?.anchor;
  if (!anchor?.id) return null;

  const surface = document.querySelector('[data-checkout-heatmap-surface="shop-content"]');
  let el = document.querySelector(`[data-heatmap-id="${CSS.escape(anchor.id)}"]`);
  if (!el && anchorIndex) el = anchorIndex.get(anchor.id) || null;
  if (!surface || !el) return null;

  const isFixed = window.getComputedStyle(el).position === "fixed";
  const elRect = el.getBoundingClientRect();
  const centerX = elRect.left + elRect.width / 2;
  const centerY = elRect.top + elRect.height / 2;

  if (isFixed) {
    // Use CSS-derived offsets instead of getBoundingClientRect() to avoid
    // momentary wrong values during mobile scroll (getBoundingClientRect on
    // fixed elements can jitter when the mobile browser chrome animates).
    const style = window.getComputedStyle(el);
    const cssRight = parseFloat(style.right);
    const cssBottom = parseFloat(style.bottom);
    const rightFromEdge = (style.right !== "auto" && !isNaN(cssRight))
      ? cssRight + elRect.width / 2
      : window.innerWidth - centerX;
    const bottomFromEdge = (style.bottom !== "auto" && !isNaN(cssBottom))
      ? cssBottom + elRect.height / 2
      : window.innerHeight - centerY;
    const right = Math.round(rightFromEdge - (anchor.dx || 0));
    const bottom = Math.round(bottomFromEdge - (anchor.dy || 0));
    return {
      x: Math.round(window.innerWidth - right),
      y: Math.round(window.innerHeight - bottom),
      right,
      bottom,
      fixed: true,
    };
  }

  const surfaceRect = surface.getBoundingClientRect();
  return {
    x: Math.round(centerX - surfaceRect.left + (anchor.dx || 0)),
    y: Math.round(centerY - surfaceRect.top + (anchor.dy || 0)),
  };
}

function getSessionsSignature(sessions) {
  return (Array.isArray(sessions) ? sessions : [])
    .map((session) => `${session.id}:${session.clickCount || session.events?.length || 0}:${session.finalizedAt || ""}`)
    .join("|");
}

function getPointsSignature(points) {
  return (Array.isArray(points) ? points : [])
    .map((point) => `${point.x}:${point.y}:${point.count}:${point.radius}`)
    .join("|");
}


function HeatmapFallback() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-10 text-sm text-slate-500">
      Loading heatmap...
    </main>
  );
}
