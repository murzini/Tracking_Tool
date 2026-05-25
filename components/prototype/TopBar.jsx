"use client";

import React from "react";
import { Backpack, ChevronDown, Flame, Trash2 } from "lucide-react";
import { flushCheckoutHeatmapSession } from "../../lib/prototype/checkoutHeatmapClient";

const HEATMAP_STEPS = [
  { step: "personal-info", label: "Personal Information" },
  { step: "delivery", label: "Choose Delivery" },
  { step: "pay", label: "Pay & Finish" },
];

export function TopBar({ onGoHome, heatmapHref = "/checkout/001/heatmap", showM1Actions = true, note = null }) {
  const [clearing, setClearing] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const triggerRef = React.useRef(null);

  React.useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const openHeatmap = async (step) => {
    setMenuOpen(false);
    await flushCheckoutHeatmapSession();
    const url = `${heatmapHref}?step=${encodeURIComponent(step)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const clearHeatmapData = async () => {
    if (clearing) return;

    setClearing(true);
    try {
      await fetch("/api/checkout-heatmap", { method: "DELETE" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur" data-heatmap-id="nav:header" data-heatmap-type="nav" data-heatmap-label="Header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onGoHome}
            className="group flex items-center gap-2 rounded-2xl px-2 py-1 transition hover:bg-black/5"
            aria-label="Go to Welcome"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3C5A7D] text-white shadow-sm">
              <Backpack className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold leading-none">AdventureBag</div>
              <div className="text-xs text-black/50">Student training prototype</div>
            </div>
          </button>
          {note}
        </div>

        <div className="flex items-center gap-2">
          {showM1Actions ? (
            <div className="flex items-center gap-2" data-heatmap-ignore="true">
              <div className="relative" ref={menuRef}>
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  <Flame className="h-4 w-4 text-[#D9480F]" />
                  <span className="hidden sm:inline">Heatmap</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    aria-label="Open heatmap for step"
                    className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border bg-white py-1 shadow-lg"
                  >
                    {HEATMAP_STEPS.map(({ step, label }) => (
                      <button
                        key={step}
                        type="button"
                        role="menuitem"
                        onClick={() => openHeatmap(step)}
                        className="block w-full px-4 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={clearHeatmapData}
                disabled={clearing}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4 text-slate-600" />
                <span className="hidden sm:inline">{clearing ? "Clearing" : "Clear data"}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
