import {
  Backpack, FileText, TrendingDown, Users, Zap,
  AlertTriangle, Eye, MousePointer, Smartphone,
  Monitor, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { isAuthorizedToken } from "@/lib/prototype/dashboardAuth";

export const metadata = { title: "Report — AdventureBag" };

const LOREM_SHORT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.";
const LOREM_LONG  = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.";

/* ── helpers ──────────────────────────────────────────────────── */
function Section({ number, title, icon: Icon, children }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
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

function Prose({ text = LOREM_LONG }) {
  return <p className="text-sm leading-relaxed text-slate-600">{text}</p>;
}

function PlaceholderImage({ seed, width, height, label, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-xl ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://picsum.photos/seed/${seed}/${width}/${height}`}
        alt={label}
        width={width}
        height={height}
        className="h-full w-full object-cover opacity-80"
      />
      <p className="mt-1 text-center text-xs text-slate-400">{label}</p>
    </div>
  );
}

function FunnelBar({ label, count, pct, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-right text-sm text-slate-600">{label}</span>
      <div className="flex-1 rounded-full bg-slate-100" style={{ height: 28 }}>
        <div
          className="flex h-full items-center justify-end rounded-full pr-3 text-xs font-semibold text-white"
          style={{ width: `${pct}%`, background: color, minWidth: 60 }}
        >
          {count.toLocaleString()}
        </div>
      </div>
      <span className="w-12 shrink-0 text-sm font-semibold text-slate-500">{pct}%</span>
    </div>
  );
}

function HBar({ label, value, max, color = "#3C5A7D" }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-right text-xs text-slate-500">{label}</span>
      <div className="flex-1 rounded bg-slate-100" style={{ height: 18 }}>
        <div
          className="flex h-full items-center rounded pl-2 text-xs font-semibold text-white"
          style={{ width: `${Math.round((value / max) * 100)}%`, background: color, minWidth: 36 }}
        >
          {value}%
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color = "#3C5A7D" }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">
      <span className="text-3xl font-extrabold" style={{ color }}>{value}</span>
      <span className="mt-1 text-sm font-semibold text-[#1F2A37]">{label}</span>
      {sub && <span className="mt-1 text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

function CompareRow({ label, completers, abandoners }) {
  return (
    <tr className="border-t border-slate-100 text-sm">
      <td className="py-2 pr-4 text-slate-500">{label}</td>
      <td className="py-2 pr-4 font-semibold text-emerald-600">{completers}</td>
      <td className="py-2 font-semibold text-rose-500">{abandoners}</td>
    </tr>
  );
}

function EventStep({ order, label, pct }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3C5A7D] text-xs font-bold text-white">
        {order}
      </span>
      <div className="flex-1 rounded bg-slate-100" style={{ height: 22 }}>
        <div
          className="flex h-full items-center rounded bg-[#3C5A7D] pl-2 text-xs font-semibold text-white"
          style={{ width: `${pct}%`, opacity: 1 - order * 0.07 }}
        >
          {label}
        </div>
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-slate-400">{pct}%</span>
    </div>
  );
}

function Rec({ n, priority, title, text }) {
  const colors = { High: "bg-rose-100 text-rose-700", Medium: "bg-amber-100 text-amber-700", Low: "bg-slate-100 text-slate-500" };
  return (
    <div className="flex gap-4 rounded-xl border border-slate-100 p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3C5A7D] text-sm font-bold text-white">{n}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1F2A37]">{title}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[priority]}`}>{priority}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}

/* ── blocked ──────────────────────────────────────────────────── */
function Blocked() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="mx-auto max-w-sm px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3C5A7D] text-white shadow-sm">
          <Backpack className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-lg font-bold text-[#1F2A37]">Access denied</h1>
        <p className="text-sm text-slate-500">A valid token is required.</p>
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────── */
export default async function ReportPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  if (!isAuthorizedToken(token)) return <Blocked />;

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
        <div className="ml-auto flex items-center gap-3">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            MOCKUP — placeholder data
          </span>
          <Link
            href={`/dashboard?token=${token}`}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">

        {/* ── 1. Intro / Methodology ────────────────────────────── */}
        <Section number="1" title="Intro & Methodology" icon={FileText}>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Steps covered", value: "3" },
              { label: "Event types", value: "10" },
              { label: "Timeframe", value: "30 days" },
              { label: "Sessions", value: "1,487" },
              { label: "Sampling rate", value: "100%" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-extrabold text-[#3C5A7D]">{m.value}</p>
                <p className="text-xs text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>
          <Prose />
        </Section>

        {/* ── 2. Executive Summary ──────────────────────────────── */}
        <Section number="2" title="Executive Summary" icon={TrendingDown}>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <MetricCard label="Overall drop-off rate" value="63%" sub="across all 3 steps" color="#e05c5c" />
            <MetricCard label="Biggest friction point" value="Personal Info" sub="47% of all drop-offs" color="#3C5A7D" />
            <MetricCard label="Top opportunity" value="Phone field" sub="24% rage-click rate" color="#e09a2b" />
          </div>
          <Prose />
        </Section>

        {/* ── 3. Funnel Overview ────────────────────────────────── */}
        <Section number="3" title="Funnel Overview" icon={Users}>
          <div className="mb-4 space-y-3">
            <FunnelBar label="Personal Info" count={1487} pct={100} color="#3C5A7D" />
            <FunnelBar label="Choose Delivery" count={847}  pct={57}  color="#5a7d9a" />
            <FunnelBar label="Pay & Finish"   count={540}  pct={36}  color="#8fafc8" />
            <FunnelBar label="Completed"      count={332}  pct={22}  color="#b0cfe0" />
          </div>
          <Prose text={LOREM_SHORT} />
        </Section>

        {/* ── 4. Step-level Drop-off ────────────────────────────── */}
        <Section number="4" title="Step-level Drop-off">
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-400">
                  <th className="pb-2 text-left">Step</th>
                  <th className="pb-2 text-right">Entries</th>
                  <th className="pb-2 text-right">Exits</th>
                  <th className="pb-2 text-right">Drop-off</th>
                  <th className="pb-2 text-right">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { step: "Personal Info",   entries: 1487, exits: 640, pct: "43%", time: "1m 52s" },
                  { step: "Choose Delivery", entries: 847,  exits: 307, pct: "36%", time: "0m 44s" },
                  { step: "Pay & Finish",    entries: 540,  exits: 208, pct: "39%", time: "1m 08s" },
                ].map((r) => (
                  <tr key={r.step} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-[#1F2A37]">{r.step}</td>
                    <td className="py-2 text-right text-slate-500">{r.entries.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-500">{r.exits.toLocaleString()}</td>
                    <td className="py-2 text-right font-semibold text-rose-500">{r.pct}</td>
                    <td className="py-2 text-right text-slate-500">{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Prose text={LOREM_SHORT} />
        </Section>

        {/* ── 5. Completers vs Non-completers ───────────────────── */}
        <Section number="5" title="Completers vs Non-completers" icon={Users}>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase text-slate-400">
                  <th className="pb-2 text-left">Metric</th>
                  <th className="pb-2 text-right text-emerald-600">Completers</th>
                  <th className="pb-2 text-right text-rose-500">Abandoners</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow label="Avg session duration"   completers="3m 12s"   abandoners="1m 04s" />
                <CompareRow label="Avg clicks"             completers="18"        abandoners="6"       />
                <CompareRow label="Scroll depth"           completers="82%"       abandoners="34%"    />
                <CompareRow label="Field interactions"     completers="14"        abandoners="4"       />
                <CompareRow label="Validation errors seen" completers="1.2"       abandoners="3.7"    />
              </tbody>
            </table>
          </div>
          <Prose text={LOREM_SHORT} />
        </Section>

        {/* ── 6. Last X Actions Before Drop-off ─────────────────── */}
        <Section number="6" title="Last Actions Before Drop-off" icon={Zap}>
          <p className="mb-3 text-xs text-slate-400">Most common final 5 events before session abandoned (% of drop-off sessions)</p>
          <div className="mb-4 space-y-2">
            <EventStep order={1} label="Clicked phone field"          pct={78} />
            <EventStep order={2} label="Validation error: phone"      pct={61} />
            <EventStep order={3} label="Clicked phone field again"    pct={54} />
            <EventStep order={4} label="Mouse moved to top of page"   pct={47} />
            <EventStep order={5} label="Browser tab left / closed"    pct={43} />
          </div>
          <Prose text={LOREM_SHORT} />
        </Section>

        {/* ── 7. Field-level Friction ───────────────────────────── */}
        <Section number="7" title="Field-level Friction" icon={AlertTriangle}>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Abandonment rate by field</p>
              <div className="space-y-2">
                <HBar label="tel:phone-number"    value={24} max={30} color="#e05c5c" />
                <HBar label="date:birthdate"      value={18} max={30} color="#e07c2b" />
                <HBar label="dropdown:street"     value={14} max={30} color="#3C5A7D" />
                <HBar label="text:zip"            value={11} max={30} color="#3C5A7D" />
                <HBar label="text:house-number"   value={8}  max={30} color="#3C5A7D" />
                <HBar label="text:name"           value={5}  max={30} color="#5a7d9a" />
              </div>
            </div>
            <PlaceholderImage seed="heatmap-fields" width={320} height={240} label="Click heatmap — Personal Info" />
          </div>
          <Prose text={LOREM_SHORT} />
        </Section>

        {/* ── 8. Error Analysis ─────────────────────────────────── */}
        <Section number="8" title="Error Analysis" icon={AlertTriangle}>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Errors per field (avg per session)</p>
              <div className="space-y-2">
                <HBar label="Phone number"    value={3.7} max={5} color="#e05c5c" />
                <HBar label="Birthdate"       value={2.1} max={5} color="#e07c2b" />
                <HBar label="Street"          value={1.4} max={5} color="#3C5A7D" />
                <HBar label="ZIP"             value={0.9} max={5} color="#5a7d9a" />
              </div>
            </div>
            <PlaceholderImage seed="errors-chart" width={320} height={240} label="Error frequency distribution" />
          </div>
          <Prose text={LOREM_SHORT} />
        </Section>

        {/* ── 9. Attention / Engagement ─────────────────────────── */}
        <Section number="9" title="Attention & Engagement" icon={Eye}>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <PlaceholderImage seed="scroll-heatmap" width={320} height={480} label="Scroll-depth heatmap — Personal Info" />
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Visibility rate by area</p>
                <div className="space-y-2">
                  <HBar label="Order summary"        value={91} max={100} color="#3C5A7D" />
                  <HBar label="Color selector"       value={74} max={100} color="#3C5A7D" />
                  <HBar label="Accordion: pricing"   value={52} max={100} color="#5a7d9a" />
                  <HBar label="Accordion: benefits"  value={38} max={100} color="#8fafc8" />
                  <HBar label="Reviews section"      value={21} max={100} color="#b0cfe0" />
                </div>
              </div>
              <Prose text={LOREM_SHORT} />
            </div>
          </div>
        </Section>

        {/* ── 10. Frustration Signals ───────────────────────────── */}
        <Section number="10" title="Frustration Signals" icon={MousePointer}>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <MetricCard label="Rage-click sessions"  value="18%" sub="≥3 clicks same spot within 2s" color="#e05c5c" />
              <MetricCard label="Dead-click sessions"  value="31%" sub="clicks on non-interactive areas" color="#e09a2b" />
            </div>
            <PlaceholderImage seed="rage-clicks" width={320} height={300} label="Rage & dead-click heatmap" />
          </div>
          <Prose text={LOREM_SHORT} />
        </Section>

        {/* ── 11. Device / View Breakdown ───────────────────────── */}
        <Section number="11" title="Device & View Breakdown">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-slate-400">
                <Monitor className="h-3 w-3" /> Desktop (61%)
              </div>
              <PlaceholderImage seed="desktop-heatmap" width={300} height={400} label="Desktop click heatmap" />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-slate-400">
                <Smartphone className="h-3 w-3" /> Mobile (39%)
              </div>
              <PlaceholderImage seed="mobile-heatmap" width={300} height={400} label="Mobile click heatmap" />
            </div>
          </div>
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Drop-off rate by device</p>
            <HBar label="Desktop" value={58} max={80} color="#3C5A7D" />
            <HBar label="Mobile"  value={71} max={80} color="#e05c5c" />
          </div>
          <Prose text={LOREM_SHORT} />
        </Section>

        {/* ── 12. Recommendations ───────────────────────────────── */}
        <Section number="12" title="Recommendations & Hypotheses" icon={Zap}>
          <div className="space-y-3">
            <Rec n={1} priority="High"   title="Simplify phone number entry"        text="Auto-format input and pre-select country code based on browser locale. Hypothesis: reduces phone-field errors by ~40% and drop-off by ~12%." />
            <Rec n={2} priority="High"   title="Add inline birthdate guidance"       text="Show a helper tooltip earlier (on focus, not just on blur error). Hypothesis: reduces birthdate validation errors by ~30%." />
            <Rec n={3} priority="Medium" title="Surface order summary earlier"       text="77% of completers opened the order summary; only 31% of abandoners did. Showing it expanded by default may increase trust and completions." />
            <Rec n={4} priority="Medium" title="Optimise mobile phone field layout"  text="Mobile rage-click rate is 2.4× higher on the phone field. Investigate touch target size and keyboard overlap." />
            <Rec n={5} priority="Low"    title="A/B test street autocomplete"        text="14% of users drop off on the street dropdown. Autocomplete with address lookup could reduce friction significantly." />
          </div>
          <div className="mt-4">
            <Prose text={LOREM_SHORT} />
          </div>
        </Section>

        <p className="pb-4 text-center text-xs text-slate-300">
          MOCKUP — all data is placeholder. Real report powered by Claude Opus 4.7.
        </p>
      </div>
    </div>
  );
}
