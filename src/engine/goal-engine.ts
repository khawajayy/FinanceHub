/**
 * Pure logic for long-term life goals: progress (from milestones, linked tasks,
 * a tracked number, or live finance figures), pace vs. the target date, and
 * per-area summaries.
 */
import type { Task } from "./task-engine";

export const AREAS = [
  { key: "career", label: "Career", emoji: "🚀", color: "#22d3ee" },
  { key: "finance", label: "Finance", emoji: "💰", color: "#34d399" },
  { key: "health", label: "Health", emoji: "💪", color: "#f472b6" },
  { key: "learning", label: "Learning", emoji: "📚", color: "#a78bfa" },
  { key: "relationships", label: "Relationships", emoji: "🤝", color: "#fbbf24" },
  { key: "personal", label: "Personal", emoji: "✨", color: "#60a5fa" },
] as const;
export type Area = (typeof AREAS)[number]["key"];
export const areaInfo = (k: string) => AREAS.find((a) => a.key === k) || AREAS[5];

export type GoalStatus = "active" | "paused" | "done" | "dropped";
/**
 * How progress is measured:
 *  checklist  – milestones + linked tasks completed
 *  number     – a tracked value moving from `start` to `target` (works downwards too, e.g. weight)
 *  networth   – Hub total net worth (PKR) from `start` to `target`
 *  portfolio  – investment equity (USD) from `start` to `target`
 */
export type Metric = "checklist" | "number" | "networth" | "portfolio";

export interface Milestone { id: string; title: string; done: boolean; due: string | null }
export interface LogPoint { t: number; v: number }

export interface Goal {
  id: string;
  title: string;
  why: string;
  area: Area;
  status: GoalStatus;
  startDate: string; // YYYY-MM-DD
  targetDate: string | null;
  metric: Metric;
  unit: string; // label for `number` goals, e.g. "km", "kg", "books"
  start: number;
  target: number;
  current: number; // latest value for `number` goals
  log: LogPoint[];
  milestones: Milestone[];
  createdAt: number;
  completedAt: number | null;
}

export interface GoalCtx { tasks: Task[]; netWorthPkr: number | null; equityUsd: number | null; today: string }

const D = 86400000;
const p2 = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const ms = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function linkedTasks(g: Goal, tasks: Task[]) {
  return tasks.filter((t) => t.goalId === g.id);
}

/** Current value for value-based metrics (null when the live figure isn't available yet). */
export function currentValue(g: Goal, ctx: GoalCtx): number | null {
  if (g.metric === "number") return g.current;
  if (g.metric === "networth") return ctx.netWorthPkr;
  if (g.metric === "portfolio") return ctx.equityUsd;
  return null;
}

export function progress(g: Goal, ctx: GoalCtx) {
  if (g.status === "done") return { pct: 1, done: 0, total: 0, value: currentValue(g, ctx) };
  if (g.metric === "checklist") {
    const lt = linkedTasks(g, ctx.tasks);
    const total = g.milestones.length + lt.length;
    const done = g.milestones.filter((m) => m.done).length + lt.filter((t) => t.done).length;
    return { pct: total ? done / total : 0, done, total, value: null as number | null };
  }
  const v = currentValue(g, ctx);
  if (v == null || g.target === g.start) return { pct: 0, done: 0, total: 0, value: v };
  return { pct: clamp01((v - g.start) / (g.target - g.start)), done: 0, total: 0, value: v };
}

export type Pace = "done" | "ahead" | "on-track" | "at-risk" | "overdue" | "paused" | "no-date";
export const PACE_LABEL: Record<Pace, string> = {
  done: "Achieved", ahead: "Ahead", "on-track": "On track", "at-risk": "At risk", overdue: "Overdue", paused: "Paused", "no-date": "No deadline",
};

/** Compares actual progress with straight-line expected progress from start to target date. */
export function pace(g: Goal, pct: number, today: string) {
  const daysLeft = g.targetDate ? Math.round((ms(g.targetDate) - ms(today)) / D) : null;
  if (g.status === "done") return { pace: "done" as Pace, expected: 1, daysLeft };
  if (g.status === "paused" || g.status === "dropped") return { pace: "paused" as Pace, expected: 0, daysLeft };
  if (!g.targetDate) return { pace: "no-date" as Pace, expected: 0, daysLeft };
  const span = Math.max(1, ms(g.targetDate) - ms(g.startDate));
  const expected = clamp01((ms(today) - ms(g.startDate)) / span);
  let p: Pace;
  if (daysLeft! < 0 && pct < 1) p = "overdue";
  else if (pct >= expected + 0.1) p = "ahead";
  else if (pct >= expected - 0.1) p = "on-track";
  else p = "at-risk";
  return { pace: p, expected, daysLeft };
}

/** Value needed per week from now to hit the target on time (value-based goals only). */
export function requiredRate(g: Goal, value: number | null, today: string) {
  if (g.metric === "checklist" || value == null || !g.targetDate) return null;
  const weeks = (ms(g.targetDate) - ms(today)) / (7 * D);
  if (weeks <= 0) return null;
  return (g.target - value) / weeks;
}

export function evaluate(g: Goal, ctx: GoalCtx) {
  const pr = progress(g, ctx);
  const pc = pace(g, pr.pct, ctx.today);
  return { ...pr, ...pc, rate: requiredRate(g, pr.value, ctx.today) };
}

/** Average progress of active + achieved goals per area (for the life wheel). */
export function areaSummary(goals: Goal[], ctx: GoalCtx) {
  return AREAS.map((a) => {
    const gs = goals.filter((g) => g.area === a.key && (g.status === "active" || g.status === "done"));
    const avg = gs.length ? gs.reduce((s, g) => s + progress(g, ctx).pct, 0) / gs.length : 0;
    return { ...a, count: gs.length, avg };
  });
}

export function goalStats(goals: Goal[], ctx: GoalCtx) {
  const year = ctx.today.slice(0, 4);
  const active = goals.filter((g) => g.status === "active");
  const ev = active.map((g) => evaluate(g, ctx));
  return {
    active: active.length,
    onTrack: ev.filter((e) => e.pace === "on-track" || e.pace === "ahead").length,
    atRisk: ev.filter((e) => e.pace === "at-risk" || e.pace === "overdue").length,
    doneThisYear: goals.filter((g) => g.status === "done" && g.completedAt && new Date(g.completedAt).getFullYear() === +year).length,
  };
}

/** Next milestone that isn't done (earliest due first, undated last). */
export function nextMilestone(g: Goal) {
  return [...g.milestones].filter((m) => !m.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))[0] || null;
}

export function sortGoals(a: Goal, b: Goal) {
  const rank = (g: Goal) => (g.status === "active" ? 0 : g.status === "paused" ? 1 : g.status === "done" ? 2 : 3);
  return rank(a) - rank(b) || (a.targetDate || "9999").localeCompare(b.targetDate || "9999") || a.createdAt - b.createdAt;
}
