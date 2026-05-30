"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Backpack, FileText, TrendingDown, Zap, ArrowLeft, AlertTriangle, RefreshCw,
} from "lucide-react";

const STEP_LABELS = {
  "personal-info": "Personal Information",
  delivery: "Choose Delivery",
  pay: "Pay & Finish",
};
const STEP_ORDER = ["personal-info", "delivery", "pay"];
const BRAND = "#3C5A7D";
const BRAND_LIGHT = "#6B8EB5";
const DANGER = "#F87171";

const PRIORITY_STYLES = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-500",
};

// Bold step names and percentage numbers in Claude's narrative text
const BOLD_PAT = /(Personal Information|Choose Delivery|Pay & Finish|\d+(?:\.\d+)?%)/g;

function boldText(text) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  BOLD_PAT.lastIndex = 0;
  let m;
  while ((m = BOLD_PAT.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <strong key={m.index} className="font-semibold text-slate-800">{m[0]}</strong>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

function Prose({ text }) {
  return <p className="text-sm leading-relaxed text-slate-600">{boldText(text)}</p>;
}

function SectionWrapper({ number, title, icon: Icon, sectionKey, children }) {
  return (
    <section data-report-section={sectionKey} className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3C5A7D] text-xs font-bold text-white">
          {number}
        </span>
        {Icon && <Icon className="h-5 w-5 text-[#3C5A7D]" />}
        <h2 className="text-lg font-bold text-[#1F2A37]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}

// --- Visualisation components ---

function StepFunnelChart({ perStepTotals }) {
  if (!perStepTotals?.length) return null;
  const data = STEP_ORDER
    .map((step) => perStepTotals.find((s) => s.step === step))
    .filter(Boolean)
    .map((s) => ({
      name: STEP_LABELS[s.step] ?? s.step,
      sessions: s.total,
      abandoned: s.abandoned,
    }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="sessions" name="Total" fill={BRAND} radius={[4, 4, 0, 0]} />
        <Bar dataKey="abandoned" name="Abandoned" fill={DANGER} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ExitReasonChart({ sessionsByExitReason }) {
  if (!sessionsByExitReason) return null;
  const LABELS = {
    idle: "Idle timeout",
    "left-browser": "Left browser",
    "nav-click": "Nav click",
    back: "Back button",
    none: "No reason",
  };
  const data = Object.entries(sessionsByExitReason)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: LABELS[k] ?? k, count: v }))
    .sort((a, b) => b.count - a.count);
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 90, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
        <Tooltip />
        <Bar dataKey="count" name="Sessions" fill={BRAND_LIGHT} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ActiveIdleBar({ activeIdleSplit }) {
  if (!activeIdleSplit) return null;
  const { totalActiveMs, totalIdleMs } = activeIdleSplit;
  const total = totalActiveMs + totalIdleMs;
  if (!total) return null;
  const activePct = Math.round((totalActiveMs / total) * 100);
  const fmt = (ms) => `${Math.round(ms / 1000)}s`;
  return (
    <div className="mt-2">
      <div className="flex h-4 overflow-hidden rounded-full">
        <div style={{ width: `${activePct}%` }} className="bg-[#3C5A7D]" />
        <div style={{ width: `${100 - activePct}%` }} className="bg-slate-200" />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span className="font-medium text-[#3C5A7D]">
          Active {fmt(totalActiveMs)} ({activePct}%)
        </span>
        <span>Idle {fmt(totalIdleMs)} ({100 - activePct}%)</span>
      </div>
    </div>
  );
}

function FieldAbandonmentTable({ fieldAbandonmentRates }) {
  if (!fieldAbandonmentRates?.length) return null;
  return (
    <div className="mt-2 overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-slate-400">
            <th className="pb-1 text-left font-medium">Field</th>
            <th className="pb-1 text-right font-medium">Abandon %</th>
            <th className="pb-1 text-right font-medium">Focused</th>
            <th className="pb-1 text-right font-medium">Changed</th>
          </tr>
        </thead>
        <tbody>
          {fieldAbandonmentRates.map((row) => (
            <tr key={row.anchor} className="border-b border-slate-50">
              <td className="py-1 font-mono text-slate-700">{row.anchor}</td>
              <td
                className={`py-1 text-right font-semibold ${
                  row.abandonRate > 0.5 ? "text-rose-600" : "text-slate-600"
                }`}
              >
                {Math.round(row.abandonRate * 100)}%
              </td>
              <td className="py-1 text-right text-slate-500">{row.focusCount}</td>
              <td className="py-1 text-right text-slate-500">{row.changeCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DropOffTriggersTable({ dropOffTriggers }) {
  if (!dropOffTriggers?.length) return null;
  return (
    <div className="mt-2 overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-slate-400">
            <th className="pb-1 text-left font-medium">Last event before drop-off</th>
            <th className="pb-1 text-right font-medium">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {dropOffTriggers.map((row) => (
            <tr key={row.eventType} className="border-b border-slate-50">
              <td className="py-1 font-mono text-slate-700">{row.eventType}</td>
              <td className="py-1 text-right text-slate-600">{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompletorsVsDropOffTable({ completorsVsDropOff }) {
  if (!completorsVsDropOff) return null;
  const { completors, dropOffs } = completorsVsDropOff;
  const fmt = (ms) => (ms > 0 ? `${Math.round(ms / 1000)}s` : "—");
  const rows = [
    { label: "Sessions", c: completors.count, d: dropOffs.count },
    { label: "Avg total time", c: fmt(completors.avgDurationMs), d: fmt(dropOffs.avgDurationMs) },
    { label: "Avg active time", c: fmt(completors.avgActiveMs), d: fmt(dropOffs.avgActiveMs) },
    { label: "Avg idle time", c: fmt(completors.avgIdleMs), d: fmt(dropOffs.avgIdleMs) },
  ];
  return (
    <div className="mt-2 overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-slate-400">
            <th className="pb-1 text-left font-medium">Metric</th>
            <th className="pb-1 text-right font-medium">Completors</th>
            <th className="pb-1 text-right font-medium">Drop-offs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-slate-50">
              <td className="py-1 text-slate-600">{row.label}</td>
              <td className="py-1 text-right font-semibold text-emerald-700">{row.c}</td>
              <td className="py-1 text-right font-semibold text-rose-600">{row.d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main component ---

export default function ReportClientPage({ token, source }) {
  const [status, setStatus] = useState("generating"); // generating | ready | error
  const [report, setReport] = useState(null);
  const [aggregatedData, setAggregatedData] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(null);
  const timerRef = useRef(null);

  function fetchScreenshots(steps) {
    setScreenshotsLoading(true);
    const body = { source: source ?? "real" };
    if (steps?.length) body.steps = steps;
    fetch("/api/checkout-heatmap/screenshots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
      .then((res) => (res.ok ? res.json() : { screenshots: [] }))
      .then((data) => setScreenshots(data.screenshots ?? []))
      .catch(() => {})
      .finally(() => setScreenshotsLoading(false));
  }

  function startGeneration() {
    setStatus("generating");
    setReport(null);
    setAggregatedData(null);
    setScreenshots([]);
    setScreenshotsLoading(false);
    setError(null);
    setProgress(0);
    startRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      setProgress(Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / 20)))));
    }, 500);

    const apiUrl = source
      ? `/api/checkout-heatmap/report?source=${encodeURIComponent(source)}`
      : "/api/checkout-heatmap/report";

    fetch(apiUrl, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok)
          return res.json().then((d) => {
            throw new Error(d.error ?? "Report generation failed");
          });
        return res.json();
      })
      .then((data) => {
        if (!data.ok) throw new Error(data.error ?? "Report generation failed");
        clearInterval(timerRef.current);
        setProgress(100);
        setReport(data.report);
        setAggregatedData(data.aggregatedData ?? null);
        setStatus("ready");
        fetchScreenshots(data.stepsWithData ?? []);
      })
      .catch((e) => {
        clearInterval(timerRef.current);
        setError(e.message);
        setStatus("error");
      });
  }

  useEffect(() => {
    startGeneration();
    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-50">
      {/* header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3C5A7D] text-white">
          <Backpack className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-slate-400">AdventureBag</p>
          <p className="text-sm font-bold text-[#1F2A37]">Checkout Drop-off Report</p>
        </div>
        <div className="ml-auto">
          <Link
            href={`/dashboard?token=${token}`}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">

        {/* ── generating ── */}
        {status === "generating" && (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="mb-1 text-sm font-semibold text-[#1F2A37]">Generating report…</p>
            <p className="mb-5 text-xs text-slate-400">
              Analysing sessions and calling Claude. This takes 20–40 seconds.
            </p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#3C5A7D] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-right text-xs text-slate-400">{progress}%</p>
          </div>
        )}

        {/* ── error ── */}
        {status === "error" && (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
              <div>
                <p className="font-semibold text-[#1F2A37]">Generation failed</p>
                <p className="mt-1 text-sm text-slate-500">{error}</p>
                <button
                  type="button"
                  onClick={startGeneration}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#3C5A7D] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2d4460]"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── report ── */}
        {status === "ready" && report && (
          <>
            {/* 1. Intro */}
            <SectionWrapper number="1" title="Intro & Methodology" icon={FileText} sectionKey="intro">
              <Prose text={report.intro?.text ?? ""} />
            </SectionWrapper>

            {/* 2. Executive Summary */}
            <SectionWrapper number="2" title="Executive Summary" icon={TrendingDown} sectionKey="executive-summary">
              <Prose text={report.executiveSummary?.text ?? ""} />

              {aggregatedData?.perStepTotals && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Sessions per step
                  </p>
                  <StepFunnelChart perStepTotals={aggregatedData.perStepTotals} />
                </div>
              )}

              {aggregatedData?.sessionsByExitReason && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Exit reasons
                  </p>
                  <ExitReasonChart sessionsByExitReason={aggregatedData.sessionsByExitReason} />
                </div>
              )}

              {report.executiveSummary?.topRecommendation && (
                <div className="mt-4 rounded-xl border border-[#3C5A7D]/20 bg-[#3C5A7D]/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#3C5A7D]">
                    Top recommendation
                  </p>
                  <p className="mt-1 text-sm text-[#1F2A37]">
                    {report.executiveSummary.topRecommendation}
                  </p>
                </div>
              )}
            </SectionWrapper>

            {/* 3. Step Analysis */}
            <section data-report-section="step-analysis" className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3C5A7D] text-xs font-bold text-white">
                  3
                </span>
                <h2 className="text-lg font-bold text-[#1F2A37]">Step Analysis</h2>
              </div>

              {(report.stepAnalysis ?? []).map((stepData) => {
                const stepAgg = aggregatedData?.stepAnalysis?.[stepData.step];
                return (
                  <div key={stepData.step} className="rounded-2xl bg-white p-6 shadow-sm">
                    <h3 className="mb-5 font-bold text-[#1F2A37]">
                      {STEP_LABELS[stepData.step] ?? stepData.step}
                    </h3>
                    <div className="space-y-4">

                      {/* A. Heatmaps */}
                      <SubSection title="A. Heatmaps">
                        {screenshotsLoading && (
                          <p className="mb-3 animate-pulse text-xs text-slate-400">
                            Loading heatmap screenshots…
                          </p>
                        )}
                        <div className="space-y-5">
                          {[
                            { type: "clicks", label: "Clicks", analysis: stepData.clicksAnalysis },
                            { type: "scrolls", label: "Scroll", analysis: stepData.scrollAnalysis },
                            { type: "moves", label: "Mouse moves", analysis: stepData.movesAnalysis },
                          ].map(({ type, label, analysis }) => {
                            const shot = screenshots.find(
                              (s) => s.step === stepData.step && s.type === type
                            );
                            return (
                              <div key={type}>
                                <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
                                {shot && (
                                  <img
                                    src={`data:image/png;base64,${shot.screenshotBase64}`}
                                    alt={`${label} heatmap — ${STEP_LABELS[stepData.step] ?? stepData.step}`}
                                    className="mb-2 w-full rounded-lg border border-slate-100"
                                  />
                                )}
                                <Prose text={analysis ?? ""} />
                              </div>
                            );
                          })}
                        </div>
                      </SubSection>

                      {/* B. Engagement */}
                      <SubSection title="B. Engagement">
                        <Prose text={stepData.engagement ?? ""} />
                        <ActiveIdleBar activeIdleSplit={stepAgg?.activeIdleSplit} />
                      </SubSection>

                      {/* C. Friction */}
                      <SubSection title="C. Friction">
                        <Prose text={stepData.friction ?? ""} />
                        <FieldAbandonmentTable fieldAbandonmentRates={stepAgg?.fieldAbandonmentRates} />
                      </SubSection>

                      {/* D. Drop-off patterns */}
                      <SubSection title="D. Drop-off patterns">
                        <Prose text={stepData.dropOffPatterns ?? ""} />
                        <DropOffTriggersTable dropOffTriggers={stepAgg?.dropOffTriggers} />
                      </SubSection>

                      {/* E. Completers vs drop-offs */}
                      <SubSection title="E. Completers vs drop-offs">
                        <Prose text={stepData.completorsVsDropOffs ?? ""} />
                        <CompletorsVsDropOffTable completorsVsDropOff={stepAgg?.completorsVsDropOff} />
                      </SubSection>

                    </div>
                  </div>
                );
              })}
            </section>

            {/* 4. Conclusions */}
            <SectionWrapper number="4" title="Conclusions" icon={Zap} sectionKey="conclusions">
              <div className="space-y-3">
                {(report.conclusions?.hypotheses ?? []).map((h, i) => (
                  <div key={i} className="flex gap-4 rounded-xl border border-slate-100 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3C5A7D] text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#1F2A37]">{h.hypothesis}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                            PRIORITY_STYLES[h.priority] ?? PRIORITY_STYLES.medium
                          }`}
                        >
                          {h.priority}
                        </span>
                      </div>
                      {h.draftDesign && (
                        <p className="mt-1 text-sm text-slate-500">{h.draftDesign}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionWrapper>
          </>
        )}

      </div>
    </div>
  );
}
