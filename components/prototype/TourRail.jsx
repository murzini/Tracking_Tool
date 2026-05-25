"use client";

import React from "react";
import { ArrowRight, ChevronLeft, GraduationCap } from "lucide-react";
import { Button } from "../ui/button";

export function TourRail({ stepIndex, totalSteps, label, onNext, onPrev, onExit, nextLabel }) {
  const pct = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 rounded-[2rem] border bg-white/90 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7BAACB]/[0.25]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Shop tour</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Step {stepIndex + 1} of {totalSteps} - {label}
              </div>
              <div className="mt-2 h-2 w-64 overflow-hidden rounded-full bg-black/10">
                <div className="h-2 bg-[#3C5A7D]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={onExit}>
              Exit tour
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={onPrev}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button className="rounded-2xl" onClick={onNext}>
              {nextLabel || "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
