"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

// Minimal, dependency-free Accordion.
// Intended only for this prototype (avoids adding Radix dependencies).

const AccordionCtx = createContext(null);

export function Accordion({
  children,
  type = "single",
  collapsible = false,
  className,
  forceAllOpen = false,
}) {
  const [openValue, setOpenValue] = useState(null);

  const ctx = useMemo(
    () => ({
      type,
      collapsible,
      openValue,
      setOpenValue,
      forceAllOpen,
    }),
    [type, collapsible, openValue, forceAllOpen]
  );

  return (
    <AccordionCtx.Provider value={ctx}>
      <div className={cn("w-full", className)}>{children}</div>
    </AccordionCtx.Provider>
  );
}

const AccordionItemCtx = createContext(null);

export function AccordionItem({ value, className, children }) {
  const parent = useContext(AccordionCtx);
  if (!parent) {
    throw new Error("AccordionItem must be used within Accordion");
  }

  const isOpen = parent.forceAllOpen || parent.openValue === value;

  const toggle = () => {
    if (isOpen) {
      if (parent.collapsible) parent.setOpenValue(null);
      return;
    }
    parent.setOpenValue(value);
  };

  const ctx = useMemo(() => ({ value, isOpen, toggle }), [value, isOpen]);

  return (
    <AccordionItemCtx.Provider value={ctx}>
      <div
        className={cn("w-full", className)}
        data-state={isOpen ? "open" : "closed"}
      >
        {children}
      </div>
    </AccordionItemCtx.Provider>
  );
}

export function AccordionTrigger({ className, children, ...rest }) {
  const item = useContext(AccordionItemCtx);
  if (!item) {
    throw new Error("AccordionTrigger must be used within AccordionItem");
  }

  return (
    <button
      type="button"
      onClick={item.toggle}
      aria-expanded={item.isOpen}
      {...rest}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20",
        className
      )}
    >
      <span>{children}</span>
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground transition",
          item.isOpen ? "rotate-180" : ""
        )}
      />
    </button>
  );
}

export function AccordionContent({ className, children }) {
  const item = useContext(AccordionItemCtx);
  if (!item) {
    throw new Error("AccordionContent must be used within AccordionItem");
  }

  if (!item.isOpen) return null;

  return <div className={cn("pt-2", className)}>{children}</div>;
}
