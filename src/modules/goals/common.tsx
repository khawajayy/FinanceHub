import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Pause, Rocket, TrendingUp } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { accountTotals } from "@/engine/expense-engine";
import { areaInfo, isoDay, PACE_LABEL, type Goal, type GoalCtx, type Pace } from "@/engine/goal-engine";
import { cx, fmtRs0, fmtUSD } from "@/lib/format";
import { useExpenses } from "@/stores/expenses";
import { pkrRate, summarize, useInvest } from "@/stores/invest";
import { useTasks } from "@/stores/tasks";

/** Live figures that finance-linked goals measure against (same total net worth as the Hub). */
export function useGoalCtx(): GoalCtx {
  const tasks = useTasks((s) => s.tasks);
  const accounts = useExpenses((s) => s.accounts);
  const transactions = useInvest((s) => s.transactions);
  const assets = useInvest((s) => s.assets);
  const prices = useInvest((s) => s.prices);
  const settings = useInvest((s) => s.settings);
  const fx = useInvest((s) => s.fx);
  return useMemo(() => {
    const equity = summarize({ transactions, assets, prices }).equity;
    const rate = pkrRate({ settings, fx });
    const owed = settings.owedToOthers || 0;
    const nw = accountTotals(accounts).net;
    return {
      tasks,
      netWorthPkr: rate != null ? nw + (equity - owed) * rate : null,
      equityUsd: transactions.length ? equity : null,
      today: isoDay(new Date()),
    };
  }, [tasks, accounts, transactions, assets, prices, settings, fx]);
}

export function fmtGoalValue(g: Goal, v: number | null) {
  if (v == null) return "—";
  if (g.metric === "networth") return fmtRs0(v);
  if (g.metric === "portfolio") return fmtUSD(v);
  return `${(Math.round(v * 100) / 100).toLocaleString()}${g.unit ? ` ${g.unit}` : ""}`;
}

const PACE_STYLE: Record<Pace, { cls: string; icon: ReactNode }> = {
  done: { cls: "!bg-pos/15 !text-pos", icon: <CheckCircle2 size={11} /> },
  ahead: { cls: "!bg-cyan/15 !text-cyan", icon: <Rocket size={11} /> },
  "on-track": { cls: "!bg-pos/12 !text-pos", icon: <TrendingUp size={11} /> },
  "at-risk": { cls: "!bg-amber/15 !text-amber", icon: <AlertTriangle size={11} /> },
  overdue: { cls: "!bg-neg/15 !text-neg", icon: <AlertTriangle size={11} /> },
  paused: { cls: "", icon: <Pause size={11} /> },
  "no-date": { cls: "", icon: <Clock size={11} /> },
};

export function PaceBadge({ pace }: { pace: Pace }) {
  const s = PACE_STYLE[pace];
  return <span className={cx("chip !normal-case !tracking-normal", s.cls)}>{s.icon}{PACE_LABEL[pace]}</span>;
}

export function daysLeftLabel(days: number | null) {
  if (days == null) return "No deadline";
  if (days < 0) return `${-days}d past target`;
  if (days === 0) return "Due today";
  if (days < 60) return `${days} days left`;
  if (days < 730) return `${Math.round(days / 30.4)} months left`;
  return `${(days / 365).toFixed(1)} years left`;
}

export function AreaDot({ area, size = 8 }: { area: string; size?: number }) {
  const a = areaInfo(area);
  return <i className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: a.color, boxShadow: `0 0 8px ${a.color}` }} />;
}

/** Radar chart of average progress per life area. */
export function LifeWheel({ data, size = 260 }: { data: { key: string; label: string; emoji: string; color: string; avg: number; count: number }[]; size?: number }) {
  const c = size / 2, R = size / 2 - 38, n = data.length;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  };
  const poly = data.map((d, i) => pt(i, R * Math.max(0.04, d.count ? d.avg : 0)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} className="mx-auto block overflow-visible">
      <defs>
        <radialGradient id="wheelFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--cyan))" stopOpacity=".45" />
          <stop offset="100%" stopColor="rgb(var(--violet))" stopOpacity=".25" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={data.map((_, i) => pt(i, R * f).join(",")).join(" ")} fill="none" stroke="rgb(var(--line) / .09)" strokeDasharray={f === 1 ? undefined : "3 4"} />
      ))}
      {data.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgb(var(--line) / .07)" />; })}
      <motion.polygon points={poly} fill="url(#wheelFill)" stroke="rgb(var(--cyan))" strokeWidth={2} strokeLinejoin="round"
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${c}px ${c}px`, filter: "drop-shadow(0 0 10px rgb(var(--cyan) / .5))" }} />
      {data.map((d, i) => {
        const [x, y] = pt(i, R * Math.max(0.04, d.count ? d.avg : 0));
        const [lx, ly] = pt(i, R + 22);
        return (
          <g key={d.key}>
            <motion.circle cx={x} cy={y} r={4} fill={d.color} initial={{ opacity: 0 }} animate={{ opacity: d.count ? 1 : 0.25 }} transition={{ delay: 0.6 + i * 0.05 }}
              style={{ filter: `drop-shadow(0 0 6px ${d.color})` }} />
            <text x={lx} y={ly - 4} textAnchor="middle" fontSize="13">{d.emoji}</text>
            <text x={lx} y={ly + 10} textAnchor="middle" fontSize="9.5" fill="rgb(var(--muted))" fontWeight={600}>{d.count ? `${Math.round(d.avg * 100)}%` : "—"}</text>
          </g>
        );
      })}
    </svg>
  );
}
