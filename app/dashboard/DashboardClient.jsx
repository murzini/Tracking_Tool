"use client";

import { useEffect, useRef, useState } from "react";
import { Backpack, Check, ChevronDown, Save, Trash2 } from "lucide-react";

const STEP_LABELS = {
  "personal-info": "Personal Information",
  delivery: "Choose Delivery",
  pay: "Pay & Finish",
};

const ELEMENT_TYPE_LABELS = {
  text: "Text input",
  toggle: "Toggle",
  display: "Display field",
  error: "Error message",
  date: "Date picker",
  tel: "Phone input",
  dropdown: "Dropdown",
  button: "Button",
  radio: "Radio",
  checkbox: "Checkbox",
  cta: "CTA button",
  icon: "Icon",
  nav: "Navigation",
  area: "Area",
  tooltip: "Tooltip trigger",
  "tooltip-content": "Tooltip content",
  accordion: "Accordion",
};

const EVENT_TYPE_GROUPS = [
  {
    label: "Interactions",
    types: ["click", "tap", "mouse-move", "scroll"],
    labels: { click: "Clicks", tap: "Taps (mobile)", "mouse-move": "Mouse movement", scroll: "Scroll depth" },
  },
  {
    label: "Field events",
    types: ["field-focus", "field-blur", "field-change", "validation-error"],
    labels: {
      "field-focus": "Field focus",
      "field-blur": "Field blur",
      "field-change": "Field change",
      "validation-error": "Validation errors",
    },
  },
  {
    label: "Visibility",
    types: ["element-visible", "element-hidden"],
    labels: { "element-visible": "Element visible", "element-hidden": "Element hidden" },
  },
];

const SAMPLING_PRESETS = [
  { label: "1%", value: 0.01 },
  { label: "10%", value: 0.1 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
];

function nearestSamplingPreset(rate) {
  const match = SAMPLING_PRESETS.find((p) => p.value === rate);
  return match ? match.value : 1;
}

const DROPOFF_PRESETS = [
  { label: "10 seconds", value: 10000 },
  { label: "30 seconds", value: 30000 },
  { label: "1 minute", value: 60000 },
  { label: "2 minutes", value: 120000 },
  { label: "5 minutes", value: 300000 },
];

function nearestDropoffPreset(ms) {
  const match = DROPOFF_PRESETS.find((p) => p.value === ms);
  return match ? match.value : 30000;
}

const CAPTURE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetRange(mode) {
  const now = new Date();
  const to = toDateStr(now);
  if (mode === "today") return { from: to, to };
  if (mode === "week") {
    const f = new Date(now);
    f.setDate(f.getDate() - 7);
    return { from: toDateStr(f), to };
  }
  if (mode === "month") {
    const f = new Date(now);
    f.setMonth(f.getMonth() - 1);
    return { from: toDateStr(f), to };
  }
  return null; // custom
}

function deriveCaptureMode(cw) {
  if (!cw || (!cw.from && !cw.to)) return "custom";
  for (const mode of ["today", "week", "month"]) {
    const r = presetRange(mode);
    if (r && r.from === cw.from && r.to === cw.to) return mode;
  }
  return "custom";
}

export function DashboardClient({ token, initialConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [staged, setStaged] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // "saved" | "error" | null
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState(null); // "cleared" | "error" | null
  const [captureMode, setCaptureMode] = useState(() => deriveCaptureMode(initialConfig.captureWindow));

  const isDirty = JSON.stringify(staged) !== JSON.stringify(config);

  function updateSteps(step, value) {
    setStaged((s) => ({ ...s, steps: { ...s.steps, [step]: value } }));
  }

  function updateEventType(type, value) {
    setStaged((s) => ({ ...s, eventTypes: { ...s.eventTypes, [type]: value } }));
  }

  function updateElementType(type, value) {
    setStaged((s) => ({ ...s, elementTypes: { ...s.elementTypes, [type]: value } }));
  }

  function updateSamplingRate(value) {
    setStaged((s) => ({ ...s, samplingRate: value }));
  }

  function updateInactivityMs(value) {
    setStaged((s) => ({ ...s, inactivityMs: value }));
  }

  function updateCaptureWindow(field, value) {
    setStaged((s) => ({
      ...s,
      captureWindow: { ...(s.captureWindow ?? {}), [field]: value || null },
    }));
  }

  function handleCaptureModeChange(mode) {
    setCaptureMode(mode);
    if (mode === "custom") return; // keep current dates, reveal pickers
    setStaged((s) => ({ ...s, captureWindow: presetRange(mode) }));
  }

  async function handleSave() {
    if (saving || !isDirty) return;
    setSaveStatus(null);
    setSaving(true);
    try {
      const res = await fetch("/api/checkout-heatmap/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ config: staged }),
      });
      if (!res.ok) throw new Error("Save failed");
      setConfig(staged);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearData() {
    if (clearing) return;
    setClearing(true);
    setClearStatus(null);
    try {
      const res = await fetch("/api/checkout-heatmap", { method: "DELETE" });
      if (!res.ok) throw new Error("Clear failed");
      setClearStatus("cleared");
      setTimeout(() => setClearStatus(null), 3000);
    } catch {
      setClearStatus("error");
      setTimeout(() => setClearStatus(null), 3000);
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-[33.6rem] px-6">
          <div className="flex items-center gap-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3C5A7D] text-white shadow-sm">
              <Backpack className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">AdventureBag</div>
              <div className="text-xs text-black/50">Admin Dashboard</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[33.6rem] px-6 py-8">
        {/* One block — Data / Heatmap / Report separated by thin lines */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          {/* ─── DATA ─── */}
          <section data-dashboard-section="data">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-xl font-bold text-[#1F2A37]">Data</h2>
              <div className="flex items-center gap-3">
                {clearStatus === "cleared" && (
                  <span className="text-xs font-medium text-green-600">All data cleared</span>
                )}
                {clearStatus === "error" && (
                  <span className="text-xs font-medium text-red-500">Clear failed — try again</span>
                )}
                <button
                  onClick={() => setShowClearConfirm(true)}
                  title="Clear all data"
                  aria-label="Clear all data"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50"
                  data-dashboard-clear-data
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Checkout steps */}
            <Row
              title="Checkout steps"
              description="Disabling a step stops recording for it immediately after Save."
            >
              <MultiSelect
                groups={[
                  {
                    items: Object.keys(staged.steps ?? {}).map((step) => ({
                      value: step,
                      label: STEP_LABELS[step] ?? step,
                    })),
                  },
                ]}
                isEnabled={(step) => !!staged.steps?.[step]}
                onToggle={(step, v) => updateSteps(step, v)}
                optionAttr="data-dashboard-step"
              />
            </Row>

            {/* Data collecting timeframe */}
            <Row title="Data collecting timeframe" description="Choose the right range.">
              <CaptureWindowSelect
                mode={captureMode}
                from={staged.captureWindow?.from ?? ""}
                to={staged.captureWindow?.to ?? ""}
                onModeChange={handleCaptureModeChange}
                onDateChange={updateCaptureWindow}
              />
            </Row>

            {/* Drop off timeframe */}
            <Row
              title="Drop off timeframe"
              description="Record session as dropped off if visitor doesn't do anything for:"
            >
              <select
                value={String(nearestDropoffPreset(staged.inactivityMs ?? 30000))}
                onChange={(e) => updateInactivityMs(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
                data-dashboard-dropoff
              >
                {DROPOFF_PRESETS.map((p) => (
                  <option key={p.value} value={String(p.value)}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Row>

            {/* Element types */}
            <Row title="Element types" description="Pick which element types to capture.">
              <MultiSelect
                groups={[
                  {
                    items: Object.keys(staged.elementTypes ?? {}).map((type) => ({
                      value: type,
                      label: ELEMENT_TYPE_LABELS[type] ?? type,
                    })),
                  },
                ]}
                isEnabled={(type) => !!staged.elementTypes?.[type]}
                onToggle={(type, v) => updateElementType(type, v)}
              />
            </Row>

            {/* Event types */}
            <Row title="Event types" description="Pick which event types to capture.">
              <MultiSelect
                groups={EVENT_TYPE_GROUPS.map((group) => ({
                  label: group.label,
                  items: group.types.map((type) => ({ value: type, label: group.labels[type] ?? type })),
                }))}
                isEnabled={(type) => staged.eventTypes?.[type] ?? true}
                onToggle={(type, v) => updateEventType(type, v)}
                optionAttr="data-dashboard-event-type"
              />
            </Row>

            {/* Sampling rate */}
            <Row title="Sampling rate" description="Percentage of visitors whose sessions are recorded.">
              <select
                value={String(nearestSamplingPreset(staged.samplingRate))}
                onChange={(e) => updateSamplingRate(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
                data-dashboard-sampling
              >
                {SAMPLING_PRESETS.map((p) => (
                  <option key={p.value} value={String(p.value)}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Row>
            {/* Save row */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
              <div className="text-sm">
                {saveStatus === "saved" && <span className="font-medium text-green-600">Saved</span>}
                {saveStatus === "error" && (
                  <span className="font-medium text-red-500">Save failed — try again</span>
                )}
                {isDirty && !saveStatus && (
                  <span className="text-xs text-slate-400">Unsaved changes</span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#3C5A7D] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d4460] disabled:opacity-50"
                data-dashboard-save
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </section>

          {/* ─── HEATMAP ─── */}
          <section data-dashboard-section="heatmap" className="border-t border-slate-100 px-5 py-4">
            <h2 className="mb-2 text-xl font-bold text-[#1F2A37]">Heatmap</h2>
            <div className="py-6 text-center text-sm text-slate-400">Coming in Part 5</div>
          </section>

          {/* ─── REPORT ─── */}
          <section data-dashboard-section="report" className="border-t border-slate-100 px-5 py-4">
            <h2 className="mb-2 text-xl font-bold text-[#1F2A37]">Report</h2>
            <div className="flex flex-col items-center py-4">
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-400"
              >
                Generate Report
              </button>
              <p className="mt-3 text-xs text-slate-400">Report generation is not yet implemented.</p>
            </div>
          </section>
        </div>
      </div>

      {/* ─── CLEAR DATA CONFIRMATION ─── */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          data-dashboard-confirm-overlay
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-bold text-[#1F2A37]">Clear all data?</h3>
            <p className="mb-6 text-sm text-slate-500">
              This permanently deletes all recorded sessions and events across every step, view, and
              timeframe. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                disabled={clearing}
                className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                data-dashboard-confirm-clear
              >
                {clearing ? "Clearing…" : "Yes, clear all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ title, description, children }) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-slate-100 px-5 py-4 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {description && <div className="mt-0.5 text-xs text-slate-400">{description}</div>}
      </div>
      <div className="w-44 shrink-0">{children}</div>
    </div>
  );
}

function MultiSelect({ groups, isEnabled, onToggle, optionAttr }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const allItems = groups.flatMap((g) => g.items);
  const enabledCount = allItems.filter((it) => isEnabled(it.value)).length;
  const total = allItems.length;
  const summary =
    enabledCount === total ? `All ${total} enabled`
    : enabledCount === 0 ? "None enabled"
    : `${enabledCount} of ${total} enabled`;

  const allOn = enabledCount === total;

  function setAll(value) {
    allItems.forEach((it) => onToggle(it.value, value));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
      >
        <span>{summary}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <div className="flex justify-end gap-3 border-b border-slate-100 px-3 py-1.5">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="text-xs font-medium text-[#3C5A7D] hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="text-xs font-medium text-slate-400 hover:underline"
            >
              Clear
            </button>
          </div>

          {groups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`}>
              {group.label && (
                <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </div>
              )}
              {group.items.map((it) => {
                const on = isEnabled(it.value);
                return (
                  <button
                    key={it.value}
                    type="button"
                    onClick={() => onToggle(it.value, !on)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    {...(optionAttr ? { [optionAttr]: it.value } : {})}
                    aria-pressed={on}
                  >
                    <span>{it.label}</span>
                    {on && <Check className="h-4 w-4 text-[#3C5A7D]" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CaptureWindowSelect({ mode, from, to, onModeChange, onDateChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const label =
    mode === "custom"
      ? from && to
        ? `${from} – ${to}`
        : from
          ? `From ${from}`
          : to
            ? `Until ${to}`
            : "Custom"
      : CAPTURE_PRESETS.find((p) => p.value === mode)?.label ?? "Custom";

  function pick(value) {
    onModeChange(value);
    if (value !== "custom") setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
        data-dashboard-capture-mode
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {CAPTURE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => pick(p.value)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span>{p.label}</span>
              {mode === p.value && <Check className="h-4 w-4 text-[#3C5A7D]" />}
            </button>
          ))}
          {mode === "custom" && (
            <div className="mt-1 flex flex-col gap-2 border-t border-slate-100 px-3 pb-2 pt-3">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-8 shrink-0">From</span>
                <input
                  type="date"
                  aria-label="From"
                  value={from}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-8 shrink-0">To</span>
                <input
                  type="date"
                  aria-label="To"
                  value={to}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
