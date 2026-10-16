import { motion } from "framer-motion";
import { Activity, BarChart3, Gauge, Flame, Plus, Settings2, TrendingUp, Zap, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { AmountInput, AnimatedNumber, Card, CardHeader, Empty, Field, Ring, Segmented, Stat } from "@/components/ui";
import { DailyBars, LineArea } from "@/components/charts";
import { continuousDaily, sortReadings } from "@/engine/power-engine";
import { cx, stripNum } from "@/lib/format";
import { usePower } from "@/stores/power";
import { toast } from "@/stores/ui";
import { LoadingGrid, PageTitle } from "@/modules/expenses/common";
import { fmt2, money, toLocalInput, usePowerStats, useUnits } from "./common";

function LogReading() {
  const add = usePower((s) => s.addReading);
  const readings = usePower((s) => s.readings);
  const [v, setV] = useState("");
  const [t, setT] = useState(() => toLocalInput(Date.now()));
  const last = sortReadings(readings).at(-1);
  const n = stripNum(v);
  const save = () => {
    if (!Number.isFinite(n)) { toast("Enter the meter reading", true); return; }
    const ms = t ? new Date(t).getTime() : Date.now();
    if (!Number.isFinite(ms)) { toast("Enter a valid date", true); return; }
    add(n, ms);
    toast(last && n < last.v && ms > last.t ? "Reading saved · lower than the last one, treated as a meter reset" : "Reading saved");
    setV(""); setT(toLocalInput(Date.now()));
  };
  return (
    <Card className="p-5" delay={0.05}>
      <div className="flex items-center gap-2"><Zap size={15} className="text-amber" /><span className="label">Log a meter reading</span></div>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_auto]" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="relative">
          <AmountInput id="power-reading" value={v} onChange={setV} placeholder={last ? `last ${fmt2(last.v)}` : "e.g. 14,520.5"} className="!py-3 !text-xl font-semibold !text-amber" aria-label="Current meter reading" />
          {last && Number.isFinite(n) && n >= last.v && <span className="num pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">+{fmt2(n - last.v)} since last</span>}
        </div>
        <input className="input" type="datetime-local" value={t} onChange={(e) => setT(e.target.value)} aria-label="Date and time" />
        <button className="btn btn-primary !py-3" type="submit"><Plus size={16} /> Add reading</button>
      </form>
      <p className="mt-2 text-[11.5px] text-muted">Time defaults to now. Change it when logging a past reading.</p>
    </Card>
  );
}

function SettingsCard() {
  const s = usePower((x) => x.settings);
  const set = usePower((x) => x.setSettings);
  const [rate, setRate] = useState(String(s.rate));
  const [day, setDay] = useState(String(s.billDay));
  return (
    <Card className="p-5" delay={0.1}>
      <div className="flex items-center gap-2"><Settings2 size={15} className="text-muted" /><span className="label">Tariff & cycle</span></div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Rate (PKR / unit)">
          <input className="input num" type="number" step="any" min={0} value={rate} onChange={(e) => setRate(e.target.value)}
            onBlur={() => { const v = parseFloat(rate); if (v >= 0 && v !== s.rate) { set({ rate: v }); toast("Tariff saved"); } else setRate(String(s.rate)); }} />
        </Field>
        <Field label="Billing day">
          <input className="input num" type="number" min={1} max={31} step={1} value={day} onChange={(e) => setDay(e.target.value)}
            onBlur={() => { const v = parseInt(day, 10); if (v >= 1 && v <= 31 && v !== s.billDay) { set({ billDay: v }); toast("Billing day saved"); } else setDay(String(s.billDay)); }} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">Show usage as
        <Segmented id="punit" size="sm" value={s.unit} onChange={(unit) => set({ unit })} options={[{ value: "kWh", label: "kWh" }, { value: "units", label: "units" }]} />
      </div>
    </Card>
  );
}

export default function PowerDashboard() {
  const loaded = usePower((s) => s.loaded);
  const readings = usePower((s) => s.readings);
  const rate = usePower((s) => s.settings.rate);
  const st = usePowerStats();
  const { u, unit } = useUnits();
  const daily = useMemo(() => continuousDaily(readings, 30), [readings]);
  const meter = useMemo(() => sortReadings(readings).map((r) => ({ t: r.t, v: r.v })), [readings]);
  const df = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <>
      <PageTitle title="Electricity" sub="Meter readings, billing-cycle projections and where your units go" />
      {!loaded ? <LoadingGrid /> : (
        <div className="space-y-4">
          {!st ? (
            <Card><Empty icon="⚡" title={readings.length ? "One more reading to go" : "Start tracking your meter"}
              sub={readings.length ? "Usage appears once you've logged at least two readings." : "Log today's meter reading below, then another in a day or two to see usage, projections and your bill."} /></Card>
          ) : (
            <Card className="p-6" delay={0}>
              <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-amber/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-cyan/20 blur-3xl" />
              <div className="relative flex flex-wrap items-center gap-8">
                <Ring progress={(st.daysElapsed / st.daysInCycle) * 100} size={180} stroke={12}>
                  <div>
                    <Zap size={18} className="mx-auto text-amber" style={{ filter: "drop-shadow(0 0 8px rgb(var(--amber)))" }} />
                    <div className="num mt-1 text-2xl font-semibold">{Math.floor(st.daysElapsed)}<span className="text-sm text-muted">/{Math.round(st.daysInCycle)}</span></div>
                    <div className="text-[11px] text-muted">days into cycle</div>
                  </div>
                </Ring>
                <div className="min-w-[220px] flex-1">
                  <div className="label">This cycle · since {df(st.cycleStart)}</div>
                  <div className="mt-2 flex items-baseline gap-2"><AnimatedNumber value={st.cycleUsed} format={fmt2} className="text-5xl font-semibold" /><span className="text-lg text-muted">{unit}</span></div>
                  <div className="mt-1 text-sm text-muted">Bill so far <b className="num text-ink">{money(st.billSoFar)}</b> at Rs {fmt2(rate)}/unit</div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/10">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan via-violet to-amber" initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (st.cycleUsed / Math.max(st.projected, 1e-9)) * 100)}%` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted"><span>used</span><span>projected {u(st.projected)} by {df(st.cycleEnd)}</span></div>
                </div>
                <div className="rounded-2xl bg-amber/10 p-5 ring-1 ring-amber/25">
                  <div className="label !text-amber">Projected bill</div>
                  <AnimatedNumber value={st.projectedBill} format={money} className="mt-1 block text-3xl font-semibold text-amber" />
                  <div className="mt-1 text-xs text-muted">at this cycle's pace</div>
                </div>
              </div>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]"><LogReading /><SettingsCard /></div>

          {st && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Stat label="Avg per day" icon={<Activity size={15} />} value={st.perDay} format={(n) => u(n)} delay={0.12} sub={`across ${fmt2(st.spanDays)} days`} />
              <Stat label="Projected cycle" icon={<TrendingUp size={15} />} value={st.projected} format={(n) => u(n)} delay={0.16} sub={`by ${df(st.cycleEnd)}`} />
              <Stat label="Peak day" icon={<Flame size={15} />} value={st.peak?.used ?? 0} format={(n) => u(n)} tone="text-amber" delay={0.2}
                sub={st.peak ? new Date(st.peak.day + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : ""} />
              <Stat label="Last reading" icon={<Gauge size={15} />} value={st.last.v} format={fmt2} delay={0.24}
                sub={<span className="inline-flex items-center gap-1"><Timer size={11} />{new Date(st.last.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>} />
            </div>
          )}

          {st && (
            <div className="grid gap-4 xl:grid-cols-5">
              <Card className="xl:col-span-3" delay={0.2}>
                <CardHeader title="Daily consumption" icon={<BarChart3 size={16} />} sub={`last ${daily.length} days · amber = 30%+ above average`} />
                <div className="p-5 pt-8"><DailyBars data={daily} format={(n) => u(n)} /></div>
              </Card>
              <Card className={cx("xl:col-span-2")} delay={0.25}>
                <CardHeader title="Meter reading" icon={<Gauge size={16} />} sub="cumulative" />
                <div className="p-5"><LineArea points={meter} format={fmt2} /></div>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
