/**
 * Pure to-do logic: natural-language quick add, smart buckets, sorting and stats.
 */

export type Priority = "low" | "med" | "high";
export interface Subtask { id: string; title: string; done: boolean }
export interface Task {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  priority: Priority;
  due: string | null; // YYYY-MM-DD
  list: string | null; // lower-case tag, e.g. "finance"
  subtasks: Subtask[];
  createdAt: number;
  completedAt: number | null;
}

const p2 = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const daysBetween = (a: string, b: string) => Math.round((+parseIso(b) - +parseIso(a)) / 86400000);

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function weekdayIndex(w: string) {
  const s = w.toLowerCase();
  if (s.length < 3) return -1;
  return WEEKDAYS.findIndex((d) => d.startsWith(s) || (s === "tues" && d === "tuesday") || (s === "thur" || s === "thurs") && d === "thursday");
}
function monthIndex(w: string) {
  const s = w.toLowerCase().slice(0, 3);
  return w.length >= 3 ? MONTHS.indexOf(s) : -1;
}

/** Date for "25 oct" / "oct 25": this year, or next year if it already passed. */
function dayMonth(day: number, month: number, today: Date) {
  if (!(day >= 1 && day <= 31)) return null;
  let d = new Date(today.getFullYear(), month, day);
  if (d.getMonth() !== month) return null;
  if (d < addDays(today, 0)) d = new Date(today.getFullYear() + 1, month, day);
  return d;
}

export interface Parsed { title: string; due: string | null; priority: Priority; list: string | null }

/**
 * Parses quick-add text. Recognised tokens (removed from the title):
 *   dates:    today, tonight, tomorrow/tmr/tmrw, a weekday (mon…sunday, next occurrence),
 *             "next week" (next Monday), "in 3 days", "25 oct", "oct 25", "25/10"
 *   priority: !high / !h / !!! , !med / !m / !! , !low / !l
 *   list:     #word
 */
export function parseQuickAdd(input: string, today = new Date()): Parsed {
  let due: Date | null = null, priority: Priority = "med", list: string | null = null;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const words = input.trim().split(/\s+/).filter(Boolean);
  const keep: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i], lw = w.toLowerCase().replace(/[.,]$/, ""), next = (words[i + 1] || "").toLowerCase().replace(/[.,]$/, "");
    const m = lw.match(/^!(high|h|hi|med|m|medium|low|l|lo)$|^(!{1,3})$/);
    if (m) {
      const k = m[1] || (m[2].length === 3 ? "h" : m[2].length === 2 ? "m" : "l");
      priority = k.startsWith("h") ? "high" : k.startsWith("l") ? "low" : "med";
      continue;
    }
    const tag = w.match(/^#([\p{L}\p{N}_-]{1,24})$/u);
    if (tag) { list = tag[1].toLowerCase(); continue; }
    if (!due) {
      if (lw === "today" || lw === "tonight") { due = t0; continue; }
      if (lw === "tomorrow" || lw === "tmr" || lw === "tmrw") { due = addDays(t0, 1); continue; }
      if (lw === "next" && next === "week") { const d = (8 - t0.getDay()) % 7 || 7; due = addDays(t0, d); i++; continue; }
      if (lw === "in" && /^\d{1,3}$/.test(next) && /^(day|days|d|week|weeks|w)$/.test((words[i + 2] || "").toLowerCase())) {
        const n = parseInt(next, 10), unit = words[i + 2].toLowerCase();
        due = addDays(t0, unit.startsWith("w") ? n * 7 : n); i += 2; continue;
      }
      const wd = weekdayIndex(lw);
      if (wd >= 0 && (lw.length >= 3)) {
        // "on fri" — drop a preceding "on"
        if (keep.length && keep[keep.length - 1].toLowerCase() === "on") keep.pop();
        const diff = (wd - t0.getDay() + 7) % 7 || 7;
        due = addDays(t0, diff); continue;
      }
      const slash = lw.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (slash) { const d = dayMonth(+slash[1], +slash[2] - 1, t0); if (d) { due = d; continue; } }
      if (/^\d{1,2}(st|nd|rd|th)?$/.test(lw) && monthIndex(next) >= 0) {
        const d = dayMonth(parseInt(lw, 10), monthIndex(next), t0); if (d) { due = d; i++; continue; }
      }
      if (monthIndex(lw) >= 0 && /^\d{1,2}(st|nd|rd|th)?$/.test(next)) {
        const d = dayMonth(parseInt(next, 10), monthIndex(lw), t0); if (d) { due = d; i++; continue; }
      }
    }
    keep.push(w);
  }
  // trailing "on"/"by"/"due" left dangling after removing a date
  while (keep.length && /^(on|by|due)$/i.test(keep[keep.length - 1])) keep.pop();
  return { title: keep.join(" "), due: due ? iso(due) : null, priority, list };
}

export type Bucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "someday" | "done";
export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Overdue", today: "Today", tomorrow: "Tomorrow", week: "Next 7 days", later: "Later", someday: "Someday", done: "Completed",
};

export function bucketOf(t: Task, todayIso: string): Bucket {
  if (t.done) return "done";
  if (!t.due) return "someday";
  const d = daysBetween(todayIso, t.due);
  return d < 0 ? "overdue" : d === 0 ? "today" : d === 1 ? "tomorrow" : d <= 7 ? "week" : "later";
}

const PRI: Record<Priority, number> = { high: 0, med: 1, low: 2 };
export function sortTasks(a: Task, b: Task) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.done && b.done) return (b.completedAt || 0) - (a.completedAt || 0);
  if (a.due !== b.due) return !a.due ? 1 : !b.due ? -1 : a.due.localeCompare(b.due);
  return PRI[a.priority] - PRI[b.priority] || a.createdAt - b.createdAt;
}

export function grouped(tasks: Task[], todayIso: string, includeDone = true) {
  const order: Bucket[] = ["overdue", "today", "tomorrow", "week", "later", "someday", "done"];
  const m: Record<Bucket, Task[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [], someday: [], done: [] };
  for (const t of [...tasks].sort(sortTasks)) m[bucketOf(t, todayIso)].push(t);
  return order.filter((b) => m[b].length && (includeDone || b !== "done")).map((b) => ({ bucket: b, tasks: m[b] }));
}

/** Focus set for the Hub: overdue + due today, then high priority with no date. */
export function focusTasks(tasks: Task[], todayIso: string, limit = 6) {
  const open = tasks.filter((t) => !t.done).sort(sortTasks);
  const urgent = open.filter((t) => t.due && t.due <= todayIso);
  const rest = open.filter((t) => !urgent.includes(t) && (t.priority === "high" || (t.due && daysBetween(todayIso, t.due) <= 2)));
  return [...urgent, ...rest].slice(0, limit);
}

export function taskStats(tasks: Task[], now = new Date()) {
  const todayIso = iso(now);
  const open = tasks.filter((t) => !t.done);
  const doneToday = tasks.filter((t) => t.done && t.completedAt && iso(new Date(t.completedAt)) === todayIso).length;
  const dueToday = open.filter((t) => t.due === todayIso).length;
  const overdue = open.filter((t) => t.due && t.due < todayIso).length;
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = iso(addDays(now, i - 6));
    return { day, count: tasks.filter((t) => t.done && t.completedAt && iso(new Date(t.completedAt)) === day).length };
  });
  // streak: consecutive days (ending today, or yesterday if nothing yet today) with ≥1 completion
  const doneDays = new Set(tasks.filter((t) => t.done && t.completedAt).map((t) => iso(new Date(t.completedAt!))));
  let streak = 0;
  for (let i = doneDays.has(todayIso) ? 0 : 1; doneDays.has(iso(addDays(now, -i))); i++) streak++;
  const lists = [...new Set(tasks.map((t) => t.list).filter(Boolean) as string[])].sort();
  return { open: open.length, done: tasks.length - open.length, doneToday, dueToday, overdue, last7, streak, lists,
    todayProgress: doneToday + dueToday + overdue > 0 ? doneToday / (doneToday + dueToday + overdue) : null };
}

export function dueLabel(due: string, todayIso: string) {
  const d = daysBetween(todayIso, due);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${-d}d overdue`;
  if (d < 7) return parseIso(due).toLocaleDateString(undefined, { weekday: "short" });
  return parseIso(due).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
