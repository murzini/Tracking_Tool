"use client";

import React from "react";
import { Backpack } from "lucide-react";

export function BackpackThumb({ seed }) {
  // Placeholder image (Canvas-safe): avoids external image requests and permission popups.
  const code = String(seed).padStart(3, "0");
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#7BAACB]/[0.35] to-black/[0.06]">
      <div className="absolute inset-0" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Backpack className="h-6 w-6 text-[#3C5A7D]" />
        </div>
        <div className="text-center">
          <div className="text-xs font-semibold text-[#1F2A37]">Backpack image</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Placeholder - #{code}</div>
        </div>
      </div>
    </div>
  );
}

export function Pill({ children }) {
  return <div className="rounded-full border bg-white px-3 py-2 text-xs text-muted-foreground">{children}</div>;
}

export function StepPill({ active, children, ...rest }) {
  return (
    <div
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${active ? "bg-[#3C5A7D] text-white" : "bg-white text-muted-foreground"}`}
      {...rest}
    >
      {children}
    </div>
  );
}
