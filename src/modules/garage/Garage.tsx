import { motion } from "framer-motion";
import { Activity, AlertTriangle, ArrowRight, BarChart3, CarFront, CheckCircle2, Coins, Fuel, Gauge as GaugeIcon, Info, Lightbulb, Pencil, Plus, Route, Wrench } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AnimatedNumber, Card, CardHeader, Empty, Skeleton, Stat, Tag } from "@/components/ui";
import { LineArea } from "@/components/charts";
import { FUEL_TYPES, fuelByMonth, kindEmoji, vehicleInsights } from "@/engine/garage-engine";
import { cx, fmtRs, fmtRs0, fmtRsCompact } from "@/lib/format";
import { useGarage } from "@/stores/garage";
import { PageTitle } from "@/modules/expenses/common";
import { StatusBadge, VehicleSwitcher, dueSummary, Gauge, useVehicleData } from "./common";

const km1 = (n: number) => `${n.toFixed(1)} km/l`;

export default function Garage() {
  const loaded = useGarage((s) => s.loaded);
  const openModal = useGarage((s) => s.openModal);
  const d = useVehicleData();
  const { vehicle: v, stats, costs, reminders, today, odo, perDay, fuel, service } = d;
  const months = useMemo(() => fuelByMonth(fuel, 6, today), [fuel, today]);
  const maxMonth = Math.max(1, ...months.map((m) => m.cost));
  const insights = useMemo(() => v ? vehicleInsights({ fuel, service, reminders: reminders.map((x) => x.r), tankLitres: v.tankLitres, odo, perDay, today }) : [], [v, fuel, service, reminders, odo, perDay, today]);
  const alerts = reminders.filter((x) => x.st.status === "overdue" || x.st.status === "soon");
  const range = v?.tankLitres && stats.avgKmpl ? v.tankLitres * stats.avgKmpl : null;
  const gaugeMax = Math.max(20, Math.ceil((stats.bestKmpl ?? stats.avgKmpl ?? 15) * 1.25 / 5) * 5);

  if (!loaded) return <><PageTitle title="Garage" /><div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}<Skeleton className="h-72 md:col-span-3" /></div></>;

  if (!v) return (
    <>
      <PageTitle title="Garage" sub="Fuel average, mileage, maintenance and running costs" />
      <Card><Empty icon={<CarFront />} title="Add your first vehicle" sub="Log fill-ups and mileage to see your real fuel average and cost per km, and never miss a service or an insurance renewal."
        action={<button className="btn btn-primary" onClick={() => openModal({ type: "vehicle" })}><Plus size={15} /> Add vehicle</button>} /></Card>
    </>
  );

  return (
    <>
      <PageTitle title="Garage" sub="Fuel average, mileage, maintenance and running costs" right={<VehicleSwitcher />} />
      <div className="space-y-4">
        <Card className="p-6" key={v.id}>
          <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-cyan/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
          <div className="relative grid items-center gap-6 md:grid-cols-[230px_1fr]">
            <Gauge value={stats.avgKmpl} max={gaugeMax} label="km/l average" sub={stats.avgKmpl == null ? "needs two full tanks" : stats.lastKmpl != null ? `last tank ${stats.lastKmpl.toFixed(1)}` : undefined} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl">{kindEmoji(v.kind)}</span>
                <h2 className="font-display text-xl font-semibold">{v.name}</h2>
                {v.year && <Tag>{v.year}</Tag>}
                <Tag>{FUEL_TYPES.find((f) => f.value === v.fuelType)?.label}</Tag>
                {v.plate && <span className="num rounded-md bg-line/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider">{v.plate}</span>}
                <button className="icon-btn !h-7 !w-7" onClick={() => openModal({ type: "vehicle", id: v.id })} aria-label="Edit vehicle" title="Edit vehicle"><Pencil size={13} /></button>
              </div>
              <div className="label mt-4">Odometer</div>
              <div className="mt-1 flex items-baseline gap-2"><AnimatedNumber value={odo} format={(n) => Math.round(n).toLocaleString()} className="text-4xl font-semibold sm:text-5xl" /><span className="text-lg text-muted">km</span></div>
              <div className="mt-1 text-sm text-muted">{perDay != null ? <>about <b className="num text-ink">{Math.round(perDay * 30.44).toLocaleString()} km</b> a month</> : "Log more readings to see your driving rate"}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => openModal({ type: "fuel" })}><Fuel size={15} /> Refuel</button>
                <button className="btn" onClick={() => openModal({ type: "odometer" })}><GaugeIcon size={15} /> Log mileage</button>
                <button className="btn" onClick={() => openModal({ type: "service" })}><Wrench size={15} /> Log service</button>
              </div>
            </div>
          </div>
        </Card>

        {alerts.length > 0 && (
          <Card delay={0.05}>
            <CardHeader title="Needs attention" icon={<AlertTriangle size={16} />} right={<Link to="/garage/maintenance" className="icon-btn" aria-label="Open maintenance"><ArrowRight size={16} /></Link>} />
            <div className="divide-y divide-line/5">
              {alerts.slice(0, 4).map(({ r, st }) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{r.title}</div><div className="text-xs text-muted">{dueSummary(st)}</div></div>
                  <StatusBadge status={st.status} />
                  <button className="btn btn-sm" onClick={() => openModal({ type: "service", reminderId: r.id })}><CheckCircle2 size={13} /> Mark done</button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="Fuel average" icon={<Fuel size={15} />} value={stats.avgKmpl ?? 0} format={(n) => (stats.avgKmpl == null ? "—" : km1(n))} delay={0.08} glow="cyan"
            sub={stats.bestKmpl != null && stats.worstKmpl != null ? `best ${stats.bestKmpl.toFixed(1)} · worst ${stats.worstKmpl.toFixed(1)}` : "needs two full tanks"} />
          <Stat label="Running cost" icon={<Route size={15} />} value={costs.perKm ?? 0} format={(n) => (costs.perKm == null ? "—" : `Rs ${n.toFixed(1)}/km`)} delay={0.12}
            sub={stats.fuelCostPerKm != null ? `fuel alone Rs ${stats.fuelCostPerKm.toFixed(1)}/km` : "fuel + service"} />
          <Stat label="Per month" icon={<Coins size={15} />} value={costs.perMonth ?? 0} format={(n) => (costs.perMonth == null ? "—" : fmtRs0(n))} delay={0.16} sub={`${fmtRsCompact(costs.total)} logged so far`} />
          <Stat label="Tank range" icon={<Activity size={15} />} value={range ?? 0} format={(n) => (range == null ? "—" : `${Math.round(n).toLocaleString()} km`)} delay={0.2}
            sub={v.tankLitres ? `${v.tankLitres} L tank` : "add tank size to the vehicle"} />
        </div>

        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3" delay={0.15}>
            <CardHeader title="Fuel average trend" icon={<Activity size={16} />} sub="km/l per full tank" right={<Link to="/garage/logbook" className="btn btn-sm">Logbook</Link>} />
            <div className="p-5">
              {stats.segments.length >= 2
                ? <LineArea points={stats.segments.map((s) => ({ t: new Date(s.date + "T12:00:00").getTime(), v: +s.kmpl.toFixed(2) }))} format={(n) => `${n.toFixed(1)} km/l`} />
                : <div className="py-10 text-center text-sm text-muted">The trend appears after three full-tank fill-ups.</div>}
            </div>
          </Card>
          <Card className="xl:col-span-2" delay={0.2}>
            <CardHeader title="Fuel spend" icon={<BarChart3 size={16} />} sub="last 6 months" />
            <div className="p-5">
              <div className="flex h-[150px] items-end gap-2">
                {months.map((m, i) => (
                  <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${m.label}: ${fmtRs(m.cost)} · ${m.litres.toFixed(0)} L`}>
                    {m.cost > 0 && <span className="num text-[10px] text-muted">{fmtRsCompact(m.cost).replace("Rs ", "")}</span>}
                    <motion.div className={cx("w-full rounded-t-md", i === months.length - 1 ? "bg-gradient-to-t from-violet/40 to-violet" : "bg-gradient-to-t from-cyan/20 to-cyan/70")}
                      initial={{ height: 0 }} animate={{ height: `${Math.max(m.cost ? 4 : 1, (m.cost / maxMonth) * 85)}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-2">{months.map((m) => <span key={m.key} className="flex-1 text-center text-[10.5px] text-muted">{m.label}</span>)}</div>
              <div className="mt-4 space-y-1.5 border-t hairline pt-3 text-sm">
                <div className="flex"><span className="text-muted">Fuel total</span><span className="num ml-auto font-semibold">{fmtRs(costs.fuelCost)}</span></div>
                <div className="flex"><span className="text-muted">Service total</span><span className="num ml-auto font-semibold">{fmtRs(costs.serviceCost)}</span></div>
                <div className="flex"><span className="text-muted">Avg price</span><span className="num ml-auto font-semibold">{stats.avgPrice != null ? `Rs ${stats.avgPrice.toFixed(1)}/L` : "—"}</span></div>
              </div>
            </div>
          </Card>
        </div>

        {insights.length > 0 && (
          <Card delay={0.25}>
            <CardHeader title="Insights" icon={<Lightbulb size={16} />} />
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {insights.map((x, i) => (
                <motion.div key={x.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                  className={cx("flex gap-3 rounded-2xl p-3.5 ring-1", x.tone === "warn" ? "bg-amber/[.07] ring-amber/25" : x.tone === "good" ? "bg-pos/[.07] ring-pos/25" : "bg-line/[.03] ring-line/5")}>
                  <span className={cx("mt-0.5 shrink-0", x.tone === "warn" ? "text-amber" : x.tone === "good" ? "text-pos" : "text-cyan")}>
                    {x.tone === "warn" ? <AlertTriangle size={16} /> : x.tone === "good" ? <CheckCircle2 size={16} /> : <Info size={16} />}
                  </span>
                  <div><div className="text-sm font-semibold">{x.title}</div><div className="mt-0.5 text-xs leading-relaxed text-muted">{x.detail}</div></div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
