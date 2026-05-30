"use client";

import { useEffect, useRef, useState } from "react";
import { Backpack, Check, ChevronDown, ExternalLink, Info, Monitor, Save, Smartphone, Trash2 } from "lucide-react";
import {
  isReportGateMet,
  getGateNoteText,
  MIN_SESSIONS_OPTIONS,
  DEFAULT_MIN_SESSIONS,
} from "../../lib/prototype/reportGateLogic.js";

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
  { value: "today", label: "Today only" },
  { value: "next7", label: "Next 7 days" },
  { value: "next30", label: "Next 30 days" },
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
  const from = toDateStr(now);
  if (mode === "today") return { from, to: from };
  if (mode === "next7") {
    const t = new Date(now);
    t.setDate(t.getDate() + 7);
    return { from, to: toDateStr(t) };
  }
  if (mode === "next30") {
    const t = new Date(now);
    t.setDate(t.getDate() + 30);
    return { from, to: toDateStr(t) };
  }
  return null; // custom
}

function deriveCaptureMode(cw) {
  if (!cw || (!cw.from && !cw.to)) return "custom";
  for (const mode of ["today", "next7", "next30"]) {
    const r = presetRange(mode);
    if (r && r.from === cw.from && r.to === cw.to) return mode;
  }
  return "custom";
}

// The Heatmap views stored data, so its timeframe presets are past/present only
// (the Data section above is future-facing, since it gates new recording).
const HEATMAP_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "last-month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

function heatmapPresetRange(mode) {
  const now = new Date();
  const today = toDateStr(now);
  if (mode === "today") return { from: today, to: today };
  if (mode === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const s = toDateStr(y);
    return { from: s, to: s };
  }
  // Monday-based weeks: days since Monday = (getDay() + 6) % 7
  if (mode === "this-week") {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return { from: toDateStr(d), to: today };
  }
  if (mode === "last-week") {
    const thisMon = new Date(now);
    thisMon.setDate(thisMon.getDate() - ((thisMon.getDay() + 6) % 7));
    const lastMon = new Date(thisMon);
    lastMon.setDate(thisMon.getDate() - 7);
    const lastSun = new Date(thisMon);
    lastSun.setDate(thisMon.getDate() - 1);
    return { from: toDateStr(lastMon), to: toDateStr(lastSun) };
  }
  if (mode === "last-month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toDateStr(first), to: toDateStr(last) };
  }
  return null; // custom
}

const STAGED_KEY = "heatmap-dashboard-staged";
const HEATMAP_KEY = "heatmap-dashboard-heatmap";

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function DashboardClient({ token, initialConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [staged, setStaged] = useState(() => lsGet(STAGED_KEY) ?? initialConfig);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // "saved" | "error" | null
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState(null); // "cleared" | "error" | null
  const [captureMode, setCaptureMode] = useState(() => deriveCaptureMode((lsGet(STAGED_KEY) ?? initialConfig).captureWindow));

  // Simulation section
  const [simCount, setSimCount] = useState(null); // null = not yet loaded
  const [simGenerating, setSimGenerating] = useState(false);
  const [simDiscarding, setSimDiscarding] = useState(false);
  const [showSimDiscardConfirm, setShowSimDiscardConfirm] = useState(false);
  const [simFeedback, setSimFeedback] = useState(null); // "generated" | "discarded" | "error" | null

  // Report section
  const [reportMinSessions, setReportMinSessions] = useState(DEFAULT_MIN_SESSIONS);
  const [reportMinSessionsSaved, setReportMinSessionsSaved] = useState(DEFAULT_MIN_SESSIONS);
  const [reportMinSaveStatus, setReportMinSaveStatus] = useState(null); // "saved" | null
  const [reportSessionCount, setReportSessionCount] = useState(null); // null = loading

  function fetchReportCount(cfg) {
    const from = cfg?.captureWindow?.from ?? null;
    const to = cfg?.captureWindow?.to ?? null;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/checkout-heatmap/query?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setReportSessionCount(Array.isArray(d.sessions) ? d.sessions.length : 0))
      .catch(() => setReportSessionCount(0));
  }

  const configRef = useRef(initialConfig);
  useEffect(() => { configRef.current = config; }, [config]);

  const heatmapHydrated = useRef(false);

  useEffect(() => {
    fetch("/api/checkout-heatmap/simulate")
      .then((r) => r.json())
      .then((d) => setSimCount(typeof d.count === "number" ? d.count : 0))
      .catch(() => setSimCount(0));
    fetchReportCount(initialConfig);
    const pollId = setInterval(() => fetchReportCount(configRef.current), 10000);
    return () => clearInterval(pollId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    if (simGenerating) return;
    setSimGenerating(true);
    setSimFeedback(null);
    try {
      const res = await fetch("/api/checkout-heatmap/simulate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Generate failed");
      const d = await res.json();
      setSimCount(d.count ?? 0);
      setSimFeedback("generated");
      setTimeout(() => setSimFeedback(null), 3000);
    } catch {
      setSimFeedback("error");
      setTimeout(() => setSimFeedback(null), 3000);
    } finally {
      setSimGenerating(false);
    }
  }

  async function handleSimDiscard() {
    if (simDiscarding) return;
    setSimDiscarding(true);
    setSimFeedback(null);
    try {
      const res = await fetch("/api/checkout-heatmap/simulate", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Discard failed");
      setSimCount(0);
      setSimFeedback("discarded");
      setTimeout(() => setSimFeedback(null), 3000);
    } catch {
      setSimFeedback("error");
      setTimeout(() => setSimFeedback(null), 3000);
    } finally {
      setSimDiscarding(false);
      setShowSimDiscardConfirm(false);
    }
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("reportMinSessions");
      const n = Number(stored);
      if (MIN_SESSIONS_OPTIONS.includes(n)) {
        setReportMinSessions(n);
        setReportMinSessionsSaved(n);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const s = lsGet(HEATMAP_KEY);
    if (!s) return;
    if (s.step) setHeatmapStep(s.step);
    if (s.view) setHeatmapView(s.view);
    if (s.type) setHeatmapType(s.type);
    if (s.outcome) setHeatmapOutcome(s.outcome);
    if (s.timeframeMode) setHeatmapTimeframeMode(s.timeframeMode);
    if (s.from !== undefined) setHeatmapFrom(s.from);
    if (s.to !== undefined) setHeatmapTo(s.to);
  }, []);

  // Heatmap section — defaults here; restored from localStorage in useEffect (client-only)
  const [heatmapStep, setHeatmapStep] = useState("personal-info");
  const [heatmapView, setHeatmapView] = useState("desktop_view");
  const [heatmapType, setHeatmapType] = useState("clicks");
  const [heatmapOutcome, setHeatmapOutcome] = useState("all");
  const [heatmapTimeframeMode, setHeatmapTimeframeMode] = useState("custom");
  const [heatmapFrom, setHeatmapFrom] = useState("");
  const [heatmapTo, setHeatmapTo] = useState("");

  // Persist staged Data config and Heatmap filters to localStorage on every change
  useEffect(() => { lsSet(STAGED_KEY, staged); }, [staged]);
  useEffect(() => {
    if (!heatmapHydrated.current) {
      heatmapHydrated.current = true;
      return;
    }
    lsSet(HEATMAP_KEY, { step: heatmapStep, view: heatmapView, type: heatmapType, outcome: heatmapOutcome, timeframeMode: heatmapTimeframeMode, from: heatmapFrom, to: heatmapTo });
  }, [heatmapStep, heatmapView, heatmapType, heatmapOutcome, heatmapTimeframeMode, heatmapFrom, heatmapTo]);

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

  function handleHeatmapTimeframeModeChange(mode) {
    setHeatmapTimeframeMode(mode);
    if (mode === "custom") return;
    const r = heatmapPresetRange(mode);
    if (r) { setHeatmapFrom(r.from); setHeatmapTo(r.to); }
  }

  function handleOpenHeatmap() {
    const params = new URLSearchParams();
    params.set("step", heatmapStep);
    params.set("view", heatmapView);
    if (heatmapType !== "clicks") params.set("type", heatmapType);
    if (heatmapOutcome !== "all") params.set("outcome", heatmapOutcome);
    if (heatmapFrom) params.set("from", heatmapFrom);
    if (heatmapTo) params.set("to", heatmapTo);
    window.open(`/checkout/001/heatmap?${params.toString()}`, "_blank", "noopener");
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
      try { localStorage.removeItem(STAGED_KEY); } catch {}
      fetchReportCount(staged);
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
                triggerAttr="data-dashboard-steps-trigger"
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
          <section data-dashboard-section="heatmap" className="border-t border-slate-100">
            <div className="flex items-center gap-3 px-5 py-4">
              <h2 className="text-xl font-bold text-[#1F2A37]">Heatmap</h2>
              <HeatmapBreathingIcon />
            </div>

            <Row title="Step" description="Which checkout step to view.">
              <select
                value={heatmapStep}
                onChange={(e) => setHeatmapStep(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
                data-dashboard-heatmap-step
              >
                {Object.entries(STEP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Row>

            <Row title="View" description="Desktop or mobile layout.">
              <ViewIconSelect value={heatmapView} onChange={setHeatmapView} />
            </Row>

            <Row title="Type" description="Which interaction to visualise.">
              <select
                value={heatmapType}
                onChange={(e) => setHeatmapType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
                data-dashboard-heatmap-type
              >
                <option value="clicks">Clicks</option>
                <option value="moves">Mouse moves</option>
                <option value="scrolls">Scroll depth</option>
              </select>
            </Row>

            <Row title="Timeframe" description="Show data from this date range.">
              <CaptureWindowSelect
                presets={HEATMAP_PRESETS}
                mode={heatmapTimeframeMode}
                from={heatmapFrom}
                to={heatmapTo}
                onModeChange={handleHeatmapTimeframeModeChange}
                onDateChange={(field, value) => {
                  if (field === "from") setHeatmapFrom(value || "");
                  else setHeatmapTo(value || "");
                }}
              />
            </Row>

            <Row title="Outcome" description="Filter sessions by how they ended.">
              <select
                value={heatmapOutcome}
                onChange={(e) => setHeatmapOutcome(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
                data-dashboard-heatmap-outcome
              >
                <option value="all">All sessions</option>
                <option value="drop-offs">Drop-offs only</option>
                <option value="completers">Completers only</option>
              </select>
            </Row>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={handleOpenHeatmap}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#3C5A7D] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d4460]"
                data-dashboard-heatmap-open
              >
                <ExternalLink className="h-4 w-4" />
                Open heatmap
              </button>
            </div>
          </section>

          {/* ─── REPORT ─── */}
          <section data-dashboard-section="report" className="border-t border-slate-100 px-5 py-4">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1F2A37]">Report</h2>
            </div>

            <Row title="Minimum sessions" description="Minimum accumulated sessions required before generating a report.">
              <select
                value={String(reportMinSessions)}
                onChange={(e) => setReportMinSessions(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3C5A7D]/30"
                data-dashboard-report-min-sessions
              >
                {MIN_SESSIONS_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>{n.toLocaleString()}</option>
                ))}
              </select>
            </Row>

            <div className="flex items-center justify-between border-t border-slate-100 px-0 py-3">
              <div className="text-sm">
                {reportMinSaveStatus === "saved" && <span className="font-medium text-green-600">Saved</span>}
                {reportMinSessions !== reportMinSessionsSaved && !reportMinSaveStatus && (
                  <span className="text-xs text-slate-400">Unsaved changes</span>
                )}
              </div>
              <button
                onClick={() => {
                  try { localStorage.setItem("reportMinSessions", String(reportMinSessions)); } catch {}
                  setReportMinSessionsSaved(reportMinSessions);
                  setReportMinSaveStatus("saved");
                  setTimeout(() => setReportMinSaveStatus(null), 2500);
                }}
                disabled={reportMinSessions === reportMinSessionsSaved}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#3C5A7D] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d4460] disabled:opacity-50"
                data-dashboard-report-save
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>

            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-700" data-dashboard-report-session-count>
                {reportSessionCount === null
                  ? "Loading…"
                  : `${reportSessionCount.toLocaleString()} sessions accumulated`}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={!isReportGateMet(reportSessionCount, reportMinSessions)}
                onClick={() => { window.location.href = `/dashboard/report?token=${token}`; }}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#3C5A7D] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d4460] disabled:opacity-40"
                data-dashboard-report-generate
              >
                Generate Report
              </button>
              <p className="text-xs text-slate-400" data-dashboard-report-note>
                {getGateNoteText(reportSessionCount, reportMinSessions)}
              </p>
            </div>
          </section>

          {/* ─── SIMULATION ─── */}
          <section data-dashboard-section="simulation" className="border-t border-slate-100">
            <div className="px-5 py-4">
              <h2 className="mb-1 text-xl font-bold text-[#1F2A37]">Simulation</h2>
              <p className="mb-4 text-xs text-slate-400">
                Generate synthetic sessions to preview heatmaps at volume without real traffic.
              </p>

              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span
                  className="text-sm font-medium text-slate-700"
                  data-dashboard-sim-status
                >
                  {simCount === null
                    ? "Loading…"
                    : simCount === 0
                    ? "No simulation data"
                    : `${simCount.toLocaleString()} simulated sessions ready`}
                </span>
                {simFeedback === "generated" && (
                  <span className="ml-3 text-xs font-medium text-green-600">Generated</span>
                )}
                {simFeedback === "discarded" && (
                  <span className="ml-3 text-xs font-medium text-green-600">Discarded</span>
                )}
                {simFeedback === "error" && (
                  <span className="ml-3 text-xs font-medium text-red-500">Failed — try again</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={simGenerating}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#3C5A7D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d4460] disabled:opacity-50"
                  data-dashboard-sim-generate
                >
                  {simGenerating ? "Generating…" : "Heatmap simulation"}
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = `/dashboard/report?token=${token}&source=sim`; }}
                  disabled={simCount === 0}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#3C5A7D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d4460] disabled:opacity-50"
                  data-dashboard-sim-report
                >
                  Report simulation
                </button>
                <button
                  type="button"
                  onClick={() => setShowSimDiscardConfirm(true)}
                  disabled={simDiscarding || simCount === 0}
                  title="Discard simulation data"
                  aria-label="Discard simulation data"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-40"
                  data-dashboard-sim-discard
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Demo: frozen real sessions (separate schema, no overlap with sim data) */}
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1F2A37]">Data recorded based on Maksym&apos;s actions</h3>
                  <DemoTooltip
                    label="open tooltip to see the data that is mapped to heatmap and report"
                    text="Heatmap and report are built on data collected between May 28 and May 29 for: personal information step, drop off time frame: 10 seconds, all element types, all event types, traffic 100%."
                  />
                </div>
                <p className="mb-4 text-xs text-slate-400">
                  Open tooltip to see the data that is mapped to heatmap and report.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(`/checkout/001/heatmap?source=demo&step=personal-info`, "_blank", "noopener")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#3C5A7D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d4460]"
                    data-dashboard-demo-heatmap
                  >
                    <ExternalLink className="h-4 w-4" />
                    Heatmap
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`/dashboard/report?token=${token}&source=demo`, "_blank", "noopener")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#3C5A7D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d4460]"
                    data-dashboard-demo-report
                  >
                    <ExternalLink className="h-4 w-4" />
                    Report
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ─── SIM DISCARD CONFIRMATION ─── */}
      {showSimDiscardConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          data-dashboard-sim-confirm-overlay
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-bold text-[#1F2A37]">Discard simulation data?</h3>
            <p className="mb-6 text-sm text-slate-500">
              This deletes all simulated sessions. Real captured data is not affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSimDiscardConfirm(false)}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSimDiscard}
                disabled={simDiscarding}
                className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                data-dashboard-sim-confirm-discard
              >
                {simDiscarding ? "Discarding…" : "Yes, discard"}
              </button>
            </div>
          </div>
        </div>
      )}

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

function MultiSelect({ groups, isEnabled, onToggle, optionAttr, triggerAttr }) {
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
        {...(triggerAttr ? { [triggerAttr]: true } : {})}
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

function DemoTooltip({ label, text }) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={label}
        aria-label={label}
        className="flex items-center justify-center rounded-full text-slate-400 transition hover:text-[#3C5A7D]"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-40 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="text-xs leading-relaxed text-slate-600">{text}</p>
        </div>
      )}
    </div>
  );
}

function HeatmapBreathingIcon() {
  return (
    <span className="inline-block shrink-0" aria-hidden style={{ width: 44, height: 44 }}>
      <style>{`
        @keyframes hm-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.45); }
        }
        .hm-hot-a {
          transform-box: fill-box;
          transform-origin: center;
          animation: hm-breathe 2.2s ease-in-out infinite;
        }
        .hm-hot-b {
          transform-box: fill-box;
          transform-origin: center;
          animation: hm-breathe 2.2s ease-in-out infinite;
          animation-delay: 0.8s;
        }
      `}</style>
      <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="44" height="44">
        <defs>
          <filter id="hm-f-lg" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8"/>
          </filter>
          <filter id="hm-f-md" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5"/>
          </filter>
          <filter id="hm-f-sm" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3"/>
          </filter>
        </defs>
        {/* outer blue/periwinkle glow — merges both hotspots into one organic blob */}
        <circle cx="21" cy="24" r="20" fill="#8888EE" filter="url(#hm-f-lg)" opacity="0.7"/>
        <circle cx="37" cy="35" r="16" fill="#8888EE" filter="url(#hm-f-lg)" opacity="0.6"/>
        {/* green layer */}
        <circle cx="21" cy="24" r="14" fill="#33DD33" filter="url(#hm-f-md)" opacity="0.85"/>
        <circle cx="37" cy="35" r="11" fill="#33DD33" filter="url(#hm-f-md)" opacity="0.85"/>
        {/* yellow-green layer */}
        <circle cx="21" cy="23" r="8" fill="#CCEE00" filter="url(#hm-f-sm)" opacity="0.9"/>
        <circle cx="37" cy="34" r="6" fill="#CCEE00" filter="url(#hm-f-sm)" opacity="0.9"/>
        {/* red hotspot cores — breathing */}
        <circle cx="20" cy="22" r="5" fill="#FF1800" filter="url(#hm-f-sm)" className="hm-hot-a"/>
        <circle cx="37" cy="33" r="4" fill="#FF1800" filter="url(#hm-f-sm)" className="hm-hot-b"/>
      </svg>
    </span>
  );
}

function ViewIconSelect({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[
        { v: "desktop_view", Icon: Monitor, label: "Desktop" },
        { v: "mobile_view", Icon: Smartphone, label: "Mobile" },
      ].map(({ v, Icon, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          title={label}
          aria-pressed={value === v}
          className={[
            "flex h-9 w-9 items-center justify-center rounded-lg border transition",
            value === v
              ? "border-[#3C5A7D] bg-[#3C5A7D] text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          ].join(" ")}
          data-dashboard-heatmap-view={v}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function CaptureWindowSelect({ mode, from, to, onModeChange, onDateChange, presets = CAPTURE_PRESETS }) {
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
      : presets.find((p) => p.value === mode)?.label ?? "Custom";

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
          {presets.map((p) => (
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
