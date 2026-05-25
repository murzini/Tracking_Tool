const LANDING_CONFIG_FALLBACK = {
  hero: {
    title: "Travel better with AdventureBag",
    body:
      "Thoughtfully designed backpacks for work, travel, and everyday movement. Built to last, easy to choose, and made to fit your life.",
    primaryCtaLabel: "Shop backpacks",
    secondaryCtaLabel: "View all backpacks",
  },
  categories: ["Travel", "Business", "Hiking", "Sports", "Kids"],
  trustBadges: [
    { title: "Built to last", body: "Durable materials and reliable construction." },
    { title: "Fast delivery", body: "Quick, trackable shipping options." },
    { title: "Loved by owners", body: "Comfort-first designs used every day." },
  ],
};

const SEARCH_CONFIG_FALLBACK = {
  title: "Search",
  body: "Browse backpacks. Filters work on metadata (audience, purpose, material, price band).",
  filters: ["audience", "purpose", "material", "priceBand"],
  sort: { field: "priceBand", order: "asc" },
};

const DETAILS_CONFIG_FALLBACK = {
  gallery: {
    enabled: true,
    assetOrder: ["hero", "side", "back", "detail_zipper", "detail_handle"],
  },
  specs: {
    capacityFallback: "20L",
    showAudience: true,
    showMaterial: true,
    showColor: true,
  },
  cta: {
    label: "Add to cart",
    helperText: "Prototype checkout. No payment, no shipping, no account required.",
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getLandingConfigFallback() {
  return clone(LANDING_CONFIG_FALLBACK);
}

export function getSearchConfigFallback() {
  return clone(SEARCH_CONFIG_FALLBACK);
}

export function getDetailsConfigFallback() {
  return clone(DETAILS_CONFIG_FALLBACK);
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}${path}`;
}

function isCoachProxyEnabled() {
  return process.env.SHOP_ENABLE_COACH_PROXY === "1";
}

async function fetchJsonWithTimeout(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    return data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchCoachConfig(type) {
  if (!isCoachProxyEnabled()) return null;

  const baseUrl = process.env.COACH_BASE_URL;
  if (!baseUrl) return null;

  const paths = [
    `/api/shop/${type}-config`,
    `/api/${type}-config`,
  ];

  for (const path of paths) {
    const data = await fetchJsonWithTimeout(joinUrl(baseUrl, path));
    if (data) {
      return {
        data,
        source: joinUrl(baseUrl, path),
      };
    }
  }

  return null;
}
