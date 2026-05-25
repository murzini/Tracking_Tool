"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { Button } from "../ui/button";
import { fade } from "../../lib/prototype/fade";
import { BackpackThumb } from "./Shared";

// Some callers use `onBuy`, others use `onCheckout`.
// Support both so the CTA never becomes a no-op.
export function DetailsPage({ item, onBack, onBuy, onCheckout }) {
  const handleCheckout = onBuy || onCheckout;
  if (!item) return null;

  const sku = `AB-${String(item.id).padStart(6, "0")}`;

  // Base identifier for image naming.
  // - Base item -> use its own baseId (set by catalog) or fallback to its id
  // - Variation -> use its baseId
  const baseId = item?.baseId || item?.id || null;

  // Prefer explicit imageUrl (variations will have their own hero), otherwise base items fall back to base hero.
  const heroSrc = item?.imageUrl || (baseId ? `/backpacks/${baseId}.jpg` : null);

  // Build a 5-image gallery:
  //  - hero (variation hero if present, otherwise base hero)
  //  - 4 additional images from the base model, by convention:
  //      Base_XX_side.(png|jpg), Base_XX_back.(png|jpg),
  //      Base_XX_detail_zipper.(png|jpg), Base_XX_detail_handle.(png|jpg)
  const gallery = useMemo(() => {
    const entries = [];

    if (heroSrc) {
      entries.push({ key: "hero", primary: heroSrc, fallback: null, alt: `${item.name} hero` });
    } else {
      entries.push({ key: "placeholder", primary: null, fallback: null, alt: `${item.name}` });
    }

    if (!baseId) return entries;

    const mk = (suffix, alt) => ({
      key: suffix,
      primary: `/backpacks/${baseId}_${suffix}.png`,
      fallback: `/backpacks/${baseId}_${suffix}.jpg`,
      alt,
    });

    entries.push(
      mk("side", `${item.name} side view`),
      mk("back", `${item.name} back view`),
      mk("detail_zipper", `${item.name} zipper detail`),
      mk("detail_handle", `${item.name} handle detail`)
    );

    return entries;
  }, [baseId, heroSrc, item?.name]);

  const [imgIdx, setImgIdx] = useState(0);

  // Keep placeholder thumbs stable.
  const seeds = useMemo(() => [0, 1, 2, 3, 4].map((k) => item.id * 101 + k * 17), [item.id]);

  // Reset selected image when the item changes.
  useEffect(() => {
    setImgIdx(0);
  }, [item.id]);

  const current = gallery[Math.min(imgIdx, gallery.length - 1)];

  const openCurrentInNewTab = () => {
    const url = current?.primary || current?.fallback;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const showGallery = gallery.length > 1;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6">
      <motion.div {...fade} transition={{ duration: 0.25 }}>
        <Button variant="ghost" className="mb-6 px-0 text-sm text-muted-foreground" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to search
        </Button>

        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="relative grid grid-cols-[72px_1fr] gap-6">
              <div className="flex flex-col gap-3">
                {showGallery ? (
                  gallery.map((g, i) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setImgIdx(i)}
                      aria-label={`Select image ${i + 1}`}
                      className={`aspect-square overflow-hidden rounded-xl bg-black/[0.04] transition ${
                        imgIdx === i ? "ring-2 ring-[#3C5A7D] ring-offset-2" : "hover:bg-black/[0.06]"
                      }`}
                    >
                      {g.primary ? (
                        <SmartImg
                          primary={g.primary}
                          fallback={g.fallback}
                          alt={g.alt}
                          className="h-full w-full object-cover"
                          placeholderClassName="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground"
                        />
                      ) : (
                        <BackpackThumb seed={seeds[i] || seeds[0]} />
                      )}
                    </button>
                  ))
                ) : (
                  seeds.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setImgIdx(i)}
                      aria-label={`Select image ${i + 1}`}
                      className={`aspect-square overflow-hidden rounded-xl bg-black/[0.04] transition ${
                        imgIdx === i ? "ring-2 ring-[#3C5A7D] ring-offset-2" : "hover:bg-black/[0.06]"
                      }`}
                    >
                      <BackpackThumb seed={s} />
                    </button>
                  ))
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-[2.75rem] bg-gradient-to-b from-[#7BAACB]/[0.2] to-black/[0.02]" />
                <button
                  type="button"
                  onClick={openCurrentInNewTab}
                  className="aspect-square w-full overflow-hidden rounded-[2.75rem] bg-transparent"
                  aria-label="Open image in new tab"
                >
                  {current?.primary ? (
                    <SmartImg
                      primary={current.primary}
                      fallback={current.fallback}
                      alt={current.alt}
                      className="h-full w-full object-cover"
                      placeholderClassName="h-full w-full flex items-center justify-center text-xs text-muted-foreground"
                    />
                  ) : heroSrc ? (
                    <img src={heroSrc} alt={`${item.name} hero`} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <BackpackThumb seed={seeds[imgIdx] || seeds[0]} />
                  )}
                </button>

                {showGallery && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Tip: click thumbnails to switch - click the big image to open full size
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 flex max-w-lg flex-col gap-7">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.purpose || item.forWhat}
                </div>
                <div className="mt-2 text-4xl font-semibold tracking-tight">{item.name}</div>
                <div className="mt-2 text-sm text-muted-foreground">SKU {sku}</div>
                <div className="mt-6 text-3xl font-semibold">EUR {item.price}</div>
                <div className="mt-6 max-w-md text-sm text-muted-foreground">{item.description}</div>
              </div>

              <div className="grid gap-4 rounded-3xl border bg-white p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Capacity</div>
                    <div className="mt-1">{item.capacityL || "20L"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Audience</div>
                    <div className="mt-1">{item.audience || "Unisex"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Material</div>
                    <div className="mt-1">{item.material || "Polyester"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Color</div>
                    <div className="mt-1">{item.color || "Black"}</div>
                  </div>
                </div>

                <Button
                  className="mt-2 rounded-2xl bg-[#0B1B33] hover:bg-[#0B1B33]/90"
                  onClick={() => handleCheckout?.(item)}
                >
                  Add to cart
                </Button>

                <div className="text-xs text-muted-foreground">
                  Prototype checkout. No payment, no shipping, no account required.
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SmartImg({ primary, fallback, alt, className, placeholderClassName }) {
  const [src, setSrc] = useState(primary);

  // Reset displayed src when the selected gallery image changes.
  useEffect(() => {
    setSrc(primary);
  }, [primary]);

  if (!primary) return null;

  if (!src) {
    return <div className={placeholderClassName || ""}>No image</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (fallback && src !== fallback) {
          setSrc(fallback);
        } else {
          setSrc(null);
        }
      }}
    />
  );
}
