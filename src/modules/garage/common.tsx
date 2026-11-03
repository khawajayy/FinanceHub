import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { useMemo } from "react";
import {
  currentOdo, fuelStats, isoDay, kindEmoji, kmPerDay, odoPoints, reminderStatus, runningCosts, sortFuel, sortReminders,
  type DueStatus, type Reminder,
} from "@/engine/garage-engine";
import { cx } from "@/lib/format";
import { useGarage } from "@/stores/garage";

export const fmtKm = (n: number) => `${Math.round(n).toLocaleString()} km`;
export const prettyDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const shortDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Everything the pages need for the selected vehicle (falls back to the first one). */
export function useVehicleData() {
  const { vehicles, fuel, odometer, service, reminders, selectedId } = useGarage();
  return useMemo(() => {
    const sorted = [...vehicles].sort((a, b) => a.createdAt - b.createdAt);
    const vehicle = sorted.find((v) => v.id === selectedId) || sorted[0] || null;
    const today = isoDay(new Date());
    const id = vehicle?.id;
    const f = sortFuel(fuel.filter((x) => x.vehicleId === id));
    const o = odometer.filter((x) => x.vehicleId === id);
    const s = service.filter((x) => x.vehicleId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const pts = vehicle ? odoPoints(vehicle, f, o, s) : [];
    const odo = currentOdo(pts), perDay = kmPerDay(pts, today);
    const rem = reminders.filter((x) => x.vehicleId === id)
      .map((r) => ({ r, st: reminderStatus(r, odo, perDay, today) }))
      .sort((a, b) => sortReminders(a.st, b.st));
    return {
      vehicles: sorted, vehicle, today, fuel: f, odometer: o, service: s, reminders: rem, pts, odo, perDay,
      stats: fuelStats(f), costs: runningCosts(f, s, pts, today),
    };
  }, [vehicles, fuel, odometer, service, reminders, selectedId]);
}

/** Reminders overdue or due soon, across all vehicles (sidebar badge, Hub card). */
export function useGarageAlerts() {
  const { vehicles, fuel, odometer, service, reminders } = useGarage();
  return useMemo(() => {
    const today = isoDay(new Date());
    const out: { r: Reminder; vehicleName: string; st: ReturnType<typeof reminderStatus> }[] = [];
    for (const v of vehicles) {
      const pts = odoPoints(v, fuel.filter((x) => x.vehicleId === v.id), odometer.filter((x) => x.vehicleId === v.id), service.filter((x) => x.vehicleId === v.id));
      const odo = currentOdo(pts), perDay = kmPerDay(pts, today);
      for (const r of reminders) {
        if (r.vehicleId !== v.id) continue;
        const st = reminderStatus(r, odo, perDay, today);
        if (st.status === "overdue" || st.status === "soon") out.push({ r, vehicleName: v.name, st });
      }
    }
    return out.sort((a, b) => sortReminders(a.st, b.st));
  }, [vehicles, fuel, odometer, service, reminders]);
}

const STATUS: Record<DueStatus, { label: string; cls: string; bar: string; icon: React.ReactNode }> = {
  overdue: { label: "Overdue", cls: "!bg-neg/15 !text-neg", bar: "bg-neg", icon: <AlertTriangle size={11} /> },
  soon: { label: "Due soon", cls: "!bg-amber/15 !text-amber", bar: "bg-amber", icon: <Clock size={11} /> },
  ok: { label: "OK", cls: "!bg-pos/12 !text-pos", bar: "bg-pos", icon: <CheckCircle2 size={11} /> },
  unset: { label: "No due date", cls: "", bar: "bg-muted", icon: <Clock size={11} /> },
};
export const statusBar = (s: DueStatus) => STATUS[s].bar;

export function StatusBadge({ status }: { status: DueStatus }) {
  const s = STATUS[status];
  return <span className={cx("chip !normal-case !tracking-normal", s.cls)}>{s.icon}{s.label}</span>;
}

/** "in 450 km · around 12 Dec" style summary of when something is due. */
export function dueSummary(st: ReturnType<typeof reminderStatus>) {
  const parts: string[] = [];
  if (st.kmLeft != null) parts.push(st.kmLeft < 0 ? `${fmtKm(-st.kmLeft)} over` : `in ${fmtKm(st.kmLeft)}`);
  if (st.daysLeft != null) parts.push(st.daysLeft < 0 ? `${-st.daysLeft}d late` : st.daysLeft === 0 ? "today" : `in ${st.daysLeft}d`);
  else if (st.predictedDate && st.kmLeft != null && st.kmLeft >= 0) parts.push(`around ${shortDay(st.predictedDate)}`);
  return parts.join(" · ") || "Set a due date or km";
}

export function VehicleSwitcher() {
  const { vehicles, selectedId, select, openModal } = useGarage();
  const list = useMemo(() => [...vehicles].sort((a, b) => a.createdAt - b.createdAt), [vehicles]);
  const active = selectedId && list.some((v) => v.id === selectedId) ? selectedId : list[0]?.id;
  return (
    <div className="glass inline-flex flex-wrap items-center gap-1 rounded-xl p-1">
      {list.map((v) => (
        <button key={v.id} onClick={() => select(v.id)} className={cx("relative rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors", v.id === active ? "text-ink" : "text-muted hover:text-ink")}>
          {v.id === active && <motion.span layoutId="veh-pill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan/25 to-violet/25 ring-1 ring-cyan/40" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative">{kindEmoji(v.kind)} {v.name}</span>
        </button>
      ))}
      <button className="icon-btn !h-8 !w-8" onClick={() => openModal({ type: "vehicle" })} aria-label="Add vehicle" title="Add vehicle"><Plus size={15} /></button>
    </div>
  );
}

/** Speedometer-style gauge. */
export function Gauge({ value, max, label, sub, size = 210 }: { value: number | null; max: number; label: string; sub?: string; size?: number }) {
  const c = size / 2, r = size / 2 - 16, sweep = 240, start = 150; // from lower-left, clockwise to lower-right
  const pt = (deg: number, rad = r) => [c + rad * Math.cos((deg * Math.PI) / 180), c + rad * Math.sin((deg * Math.PI) / 180)] as const;
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(from), [x2, y2] = pt(to);
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };
  const frac = value != null && max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const angle = start + sweep * frac;
  const ticks = Array.from({ length: 13 }, (_, i) => start + (sweep * i) / 12);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.86 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="overflow-visible">
        <defs><linearGradient id="gaugeG" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="rgb(var(--neg))" /><stop offset="45%" stopColor="rgb(var(--amber))" /><stop offset="100%" stopColor="rgb(var(--pos))" /></linearGradient></defs>
        <path d={arc(start, start + sweep)} fill="none" stroke="rgb(var(--line) / .08)" strokeWidth={12} strokeLinecap="round" />
        {value != null && <motion.path d={arc(start, start + sweep)} fill="none" stroke="url(#gaugeG)" strokeWidth={12} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: frac }} transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }} style={{ filter: "drop-shadow(0 0 8px rgb(var(--cyan) / .35))" }} />}
        {ticks.map((d, i) => { const [x1, y1] = pt(d, r - 12), [x2, y2] = pt(d, r - (i % 3 === 0 ? 20 : 16)); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--muted) / .5)" strokeWidth={i % 3 === 0 ? 2 : 1} />; })}
        {value != null && (
          <motion.g initial={{ rotate: start }} animate={{ rotate: angle }} transition={{ type: "spring", stiffness: 50, damping: 11, delay: 0.1 }} style={{ transformOrigin: `${c}px ${c}px` }}>
            <line x1={c} y1={c} x2={c + r - 26} y2={c} stroke="rgb(var(--ink))" strokeWidth={3} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px rgb(var(--cyan)))" }} />
          </motion.g>
        )}
        <circle cx={c} cy={c} r={7} fill="rgb(var(--bg))" stroke="rgb(var(--cyan))" strokeWidth={2.5} />
      </svg>
      <div className="absolute inset-x-0 text-center" style={{ top: size * 0.6 }}>
        <div className="num text-3xl font-semibold leading-none">{value != null ? value.toFixed(1) : "—"}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
        {sub && <div className="text-[10.5px] text-muted">{sub}</div>}
      </div>
    </div>
  );
}
