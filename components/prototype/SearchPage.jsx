"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { fade } from "../../lib/prototype/fade";
export function SearchPage({ items, onSelect, onOpenDetails }) {
  // Backward compatibility:
  // - app/shop uses `onSelect(item)`
  // - older callers used `onOpenDetails(id)`
  const handleSelect = onSelect || onOpenDetails;

  const selectItem = (item) => {
    if (!handleSelect) return;
    if (onSelect) return handleSelect(item);
    return handleSelect(item?.id);
  };

  
  const [query, setQuery] = React.useState("");
  const [audience, setAudience] = React.useState([]);
  const [purpose, setPurpose] = React.useState([]);
  const [material, setMaterial] = React.useState([]);
  const [priceBand, setPriceBand] = React.useState([]);
  const [filtersOpen, setFiltersOpen] = React.useState(false);


  const toggle = (arr, val, setter) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (q) {
        const hay = `${it.name} ${it.description || ""} ${it.color || ""} ${it.material || ""} ${it.purpose || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (audience.length && !audience.includes(it.audience)) return false;
      if (purpose.length && !purpose.includes(it.purpose)) return false;
      if (material.length && !material.includes(it.material)) return false;
      if (priceBand.length && !priceBand.includes(it.priceBand)) return false;
      return true;
    });
  }, [items, query, audience, purpose, material, priceBand]);


  const getThumbSrc = (it) => {
    // Prefer explicit imageUrl.
    // IMPORTANT: Only base products should fall back to the base image.
    // Variations intentionally show a placeholder until their own images exist,
    // otherwise filters appear to "duplicate" the same backpack photo.
    if (it?.imageUrl) return it.imageUrl;
    if (it?.isBase && it?.baseId) return `/backpacks/${it.baseId}.jpg`;
    return null;
  };

const optionSets = React.useMemo(() => {
  const uniq = (key) =>
    Array.from(new Set(items.map((it) => it[key]).filter(Boolean)));

  const sortPriceBands = (bands) => {
    const parseMin = (b) => {
      const minMatch = String(b).match(/\d+/);
      return Number(minMatch?.[0] || 0);
    };
    return [...bands].sort((a, b) => parseMin(a) - parseMin(b));
  };

  return {
    audience: uniq("audience"),
    purpose: uniq("purpose"),
    material: uniq("material"),
    priceBand: sortPriceBands(uniq("priceBand")),
  };
}, [items]);


return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <motion.div {...fade} transition={{ duration: 0.25 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Search</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Browse backpacks. Filters work on metadata (audience, purpose, material, price band).
            </p>
          </div>
          <div className="flex items-center gap-2">
  {/* Mobile filters button (desktop keeps sidebar). */}
  <button
    type="button"
    onClick={() => setFiltersOpen(true)}
    className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs text-slate-800 shadow-sm hover:bg-slate-50 lg:hidden"
  >
    <SlidersHorizontal className="h-4 w-4" />
    Filters
    {(audience.length + purpose.length + material.length + priceBand.length) > 0 ? (
      <span className="ml-1 rounded-full bg-[#0B1A33] px-2 py-0.5 text-[10px] font-semibold text-white">
        {audience.length + purpose.length + material.length + priceBand.length}
      </span>
    ) : null}
  </button>
</div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">Results: {filteredItems.length}</div>

        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <div className="hidden lg:block lg:col-span-3">
            <Card className="rounded-3xl shadow-sm">
	              <div className="px-6 pt-6 pb-2">
	                <div className="text-base font-semibold">Filters</div>
	              </div>
              <CardContent className="space-y-4">
                <FilterGroup title="Audience" values={optionSets.audience} selected={audience} onToggle={(v) => toggle(audience, v, setAudience)} />
                <FilterGroup title="Purpose" values={optionSets.purpose} selected={purpose} onToggle={(v) => toggle(purpose, v, setPurpose)} />
                <FilterGroup title="Material" values={optionSets.material} selected={material} onToggle={(v) => toggle(material, v, setMaterial)} />
                <FilterGroup title="Price" values={optionSets.priceBand} selected={priceBand} onToggle={(v) => toggle(priceBand, v, setPriceBand)} />
                <div className="pt-2">
	                  <button
	                    type="button"
	                    className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
                    onClick={() => {
                      setQuery("");
                      setAudience([]);
                      setPurpose([]);
                      setMaterial([]);
                      setPriceBand([]);
                    }}
                  >
                    Clear filters
	                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-9">
            {/* Mobile-first grid: comfy spacing + stable card rhythm */}
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((it) => (
                <button
                  key={it.id}
                  onClick={() => selectItem(it)}
                  className="block w-full text-left rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1A33]/40"
                  aria-label={`Open details for ${it.name}`}
                >
                  <Card className="rounded-3xl shadow-sm transition hover:shadow-md group cursor-pointer">
                    <CardContent className="p-4 sm:p-5">
                      <div className="relative">
                        <div className="aspect-[4/5] sm:aspect-square overflow-hidden rounded-2xl border bg-muted/20">
                          {getThumbSrc(it) ? (
                            <img
                              src={getThumbSrc(it)}
                              alt={it.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-2xl bg-black/0 transition group-hover:bg-black/20 sm:flex">
                          <div className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold opacity-0 transition group-hover:opacity-100">
                            View details
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="text-sm font-semibold leading-snug truncate">{it.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">{it.subtitle}</div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm font-semibold">EUR {it.price}</div>
                        <div className="hidden sm:inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs text-muted-foreground">
                          View
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        </div>

{/* Mobile filters modal */}
{filtersOpen ? (
  <div className="fixed inset-0 z-50 lg:hidden">
    <div
      className="absolute inset-0 bg-black/40"
      onClick={() => setFiltersOpen(false)}
      aria-hidden="true"
    />
    <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-3xl bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="text-base font-semibold">Filters</div>
        <button
          type="button"
          className="rounded-xl border bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm"
          onClick={() => setFiltersOpen(false)}
        >
          Close
        </button>
      </div>

      <Card className="rounded-3xl shadow-sm">
        <div className="px-6 pt-6 pb-2">
          <div className="text-base font-semibold">Refine results</div>
        </div>
        <CardContent className="space-y-4">
          <FilterGroup title="Audience" values={optionSets.audience} selected={audience} onToggle={(v) => toggle(audience, v, setAudience)} />
          <FilterGroup title="Purpose" values={optionSets.purpose} selected={purpose} onToggle={(v) => toggle(purpose, v, setPurpose)} />
          <FilterGroup title="Material" values={optionSets.material} selected={material} onToggle={(v) => toggle(material, v, setMaterial)} />
          <FilterGroup title="Price" values={optionSets.priceBand} selected={priceBand} onToggle={(v) => toggle(priceBand, v, setPriceBand)} />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
              onClick={() => {
                setQuery("");
                setAudience([]);
                setPurpose([]);
                setMaterial([]);
                setPriceBand([]);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="w-full rounded-2xl bg-[#0B1A33] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0B1A33]/90"
              onClick={() => setFiltersOpen(false)}
            >
              Apply
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
) : null}

      </motion.div>
    </div>
  );
}

function FilterGroup({ title, values, selected, onToggle }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const isOn = selected.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onToggle(v)}
              className={[
                "px-3 py-1 rounded-full text-xs border transition",
                isOn
                  ? "bg-black text-white border-black"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
