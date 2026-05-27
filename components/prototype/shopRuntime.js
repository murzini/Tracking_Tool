"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircleMore } from "lucide-react";
import { TopBar } from "./TopBar";
import { buildCatalogItemsFallback } from "../../lib/prototype/catalog";

const clientResourceCache = new Map();

function getCachedResource(cacheKey) {
  return clientResourceCache.get(cacheKey) || null;
}

function setCachedResource(cacheKey, value) {
  clientResourceCache.set(cacheKey, value);
  return value;
}

async function loadCachedResource(cacheKey, loader) {
  const cached = getCachedResource(cacheKey);

  if (cached?.value !== undefined) {
    return cached.value;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = loader()
    .then((value) => {
      setCachedResource(cacheKey, { value });
      return value;
    })
    .catch((error) => {
      clientResourceCache.delete(cacheKey);
      throw error;
    });

  clientResourceCache.set(cacheKey, { promise });
  return promise;
}

function readTourState(searchParams) {
  return {
    isTour: searchParams.get("tour") === "1",
    tourStep: searchParams.get("step") || "landing",
    tourSku: searchParams.get("sku"),
  };
}

export function buildShopQuery({ isTour = false, step, sku } = {}) {
  const params = new URLSearchParams();

  if (isTour) {
    params.set("tour", "1");
    if (step) params.set("step", step);
    if (sku) params.set("sku", sku);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getSearchHref(options = {}) {
  return `/search${buildShopQuery(options)}`;
}

export function getDetailsHref(sku, options = {}) {
  return `/details/${encodeURIComponent(sku)}${buildShopQuery({ ...options, sku })}`;
}

export function getCheckoutHref(sku, step = "login", options = {}) {
  // The checkout step must travel in the URL in normal mode too, otherwise the
  // CTA cannot advance the visitor from one step to the next (buildShopQuery
  // only emits step under tour=1). Tour params are preserved when isTour.
  // Test/automation params are forwarded so login → PI stays a single navigation
  // and never creates a stray session.
  const params = new URLSearchParams();
  if (options.isTour) {
    params.set("tour", "1");
    if (sku) params.set("sku", sku);
  }
  if (step) params.set("step", step);
  if (options.m1HeatmapTest) params.set("m1HeatmapTest", "1");
  if (options.m1HeatmapAnchor) params.set("m1HeatmapAnchor", "1");
  if (options.heatmapSampleRate != null) params.set("heatmapSampleRate", String(options.heatmapSampleRate));

  const query = params.toString();
  return `/checkout/${encodeURIComponent(sku)}${query ? `?${query}` : ""}`;
}

export function getCheckoutHeatmapHref(sku = "001", options = {}) {
  const params = new URLSearchParams();
  if (options.view) params.set("view", options.view);

  const query = params.toString();
  return `/checkout/${encodeURIComponent(sku)}/heatmap${query ? `?${query}` : ""}`;
}

export function getThankYouHref(options = {}) {
  return `/thankyou${buildShopQuery(options)}`;
}

export function useTourState() {
  const searchParams = useSearchParams();
  return useMemo(() => readTourState(searchParams), [searchParams]);
}

export function useCatalogData() {
  const cachedCatalog = getCachedResource("catalog")?.value || null;
  const [catalog, setCatalog] = useState(cachedCatalog || []);
  const [loading, setLoading] = useState(!cachedCatalog);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const items = await loadCachedResource("catalog", async () => {
          const res = await fetch("/api/catalog", { cache: "force-cache" });
          const data = await res.json().catch(() => ({}));
          return data?.items?.length ? data.items : buildCatalogItemsFallback();
        });

        if (!alive) return;
        setCatalog(items);
      } catch {
        if (!alive) return;
        const fallbackItems = buildCatalogItemsFallback();
        setCachedResource("catalog", { value: fallbackItems });
        setCatalog(fallbackItems);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  return { catalog, loading };
}

export function useCatalogItem(sku) {
  const { catalog, loading } = useCatalogData();

  const item = useMemo(() => {
    if (!sku) return null;
    return catalog.find((entry) => String(entry?.sku) === String(sku)) || null;
  }, [catalog, sku]);

  return { catalog, item, loading };
}

export function useRemoteConfig(path, { requireOkConfig = false } = {}) {
  const cacheKey = `config:${path}:${requireOkConfig ? "strict" : "loose"}`;
  const cachedConfig = getCachedResource(cacheKey)?.value;
  const [config, setConfig] = useState(cachedConfig === undefined ? null : cachedConfig);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const nextConfig = await loadCachedResource(cacheKey, async () => {
          const res = await fetch(path, { cache: "force-cache" });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            return null;
          }

          if (requireOkConfig) {
            return data?.ok && data?.config ? data.config : null;
          }

          return data?.config || data || null;
        });

        if (!alive) return;
        setConfig(nextConfig);
      } catch {
        if (!alive) return;
        setConfig(null);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [cacheKey, path, requireOkConfig]);

  return config;
}

export function TourShield() {
  return (
    <div
      className="fixed inset-0 z-[9999] cursor-default"
      title="Tour mode: view-only"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

export function ShopFrame({ children, isTour = false, showChat = false, heatmapPoints = null, overlay = null, topBarNote = null, topBarRight = null, forcedWidth = null, hideTopBar = false }) {
  const router = useRouter();
  const hasHeatmapPoints = Array.isArray(heatmapPoints);
  // M4 Part 6: the non-click heatmap views (mouse-move density/trails, scroll
  // fold/gradient) render a custom overlay inside the same relative surface so
  // they align to the rendered step exactly like the click dots do.
  const hasOverlay = overlay != null;

  return (
    <div className="min-h-screen bg-[#f6f7fb]" data-checkout-heatmap-surface="shop-frame">
      {hideTopBar ? null : <TopBar onGoHome={() => router.push("/")} note={topBarNote} rightContent={topBarRight} />}
      {isTour ? <TourShield /> : null}
      <div
        className={`${forcedWidth ? "mx-auto" : "mx-auto max-w-6xl"} px-4 py-6 ${hasHeatmapPoints || hasOverlay ? "relative" : ""}`}
        style={forcedWidth ? { width: forcedWidth, maxWidth: "100%" } : undefined}
        data-checkout-heatmap-surface="shop-content"
      >
        {children}
        {hasOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-50">{overlay}</div>
        ) : null}
        {hasHeatmapPoints ? (
          <div className="pointer-events-none absolute inset-0 z-50">
            {heatmapPoints.map((point) => (
              <div
                key={`${point.x}:${point.y}`}
                title={`${point.count} click${point.count === 1 ? "" : "s"}`}
                className="absolute rounded-full border border-red-700/80 shadow-[0_0_0_2px_rgba(239,68,68,0.18)]"
                style={{
                  left: point.x - point.radius,
                  top: point.y - point.radius,
                  width: point.radius * 2,
                  height: point.radius * 2,
                  backgroundColor: `rgba(239,68,68,${point.alpha})`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
      {showChat ? (
        <button
          type="button"
          aria-label="Open chat"
          data-heatmap-id="icon:chatbot"
          data-heatmap-type="icon"
          data-heatmap-label="Chatbot"
          className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#FF7A1A] bg-white text-[#FF7A1A] shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition hover:scale-[1.02] hover:shadow-[0_12px_36px_rgba(15,23,42,0.18)]"
        >
          <MessageCircleMore className="h-6 w-6" strokeWidth={1.8} />
        </button>
      ) : null}
    </div>
  );
}
