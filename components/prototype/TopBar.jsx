"use client";

import React from "react";
import { Backpack } from "lucide-react";

export function TopBar({ onGoHome, rightContent = null, note = null }) {
  return (
    <div className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur" data-heatmap-id="nav:header" data-heatmap-type="nav" data-heatmap-label="Header">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
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
          </div>
          {rightContent ? <div className="flex items-center">{rightContent}</div> : null}
        </div>
        {note ? <div className="pb-2">{note}</div> : null}
      </div>
    </div>
  );
}
