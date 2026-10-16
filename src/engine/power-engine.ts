/**
 * Pure electricity-usage logic, ported from ElectricityGuru index.html.
 * Readings are cumulative meter values; usage is the difference between readings.
 */

export interface Reading { id: string; v: number; t: number } // meter value, timestamp (ms)
export interface Appliance { id: string; name: string; watts: number; qty: number; hours: number }
export interface Cycle {
  id: string; start: string; end: string; // YYYY-MM-DD, end exclusive
  units: number; rate: number; est: number;
  actual: number | null; actualUnits: number | null; actualReading: number | null;
}
export interface PowerSettings { rate: number; billDay: number; unit: "kWh" | "units" }
export const DEFAULT_POWER_SETTINGS: PowerSettings = { rate: 50, billDay: 1, unit: "kWh" };

const D = 86400000;
const p2 = (x: number) => String(x).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const dayKey = (ts: number) => isoDate(new Date(ts));
export const parseIso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

/** Start (inclusive) and end (exclusive) of the billing cycle containing `now`. Clamps to month length. */
export function cycleBounds(now: Date, day: number) {
  const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  let y = now.getFullYear(), m = now.getMonth();
  let start = new Date(y, m, Math.min(day, dim(y, m)));
  if (now < start) { m -= 1; if (m < 0) { m = 11; y -= 1; } start = new Date(y, m, Math.min(day, dim(y, m))); }
  let ey = start.getFullYear(), em = start.getMonth() + 1;
  if (em > 11) { em = 0; ey += 1; }
  return { start, end: new Date(ey, em, Math.min(day, dim(ey, em))) };
}

export const sortReadings = (r: Reading[]) => [...r].sort((a, b) => a.t - b.t);

export function intervals(readings: Reading[]) {
  const r = sortReadings(readings);
  const out: { from: Reading; to: Reading; used: number; ms: number }[] = [];
  for (let i = 1; i < r.length; i++) out.push({ from: r[i - 1], to: r[i], used: r[i].v - r[i - 1].v, ms: r[i].t - r[i - 1].t });
  return out;
}

/** Usage per calendar day, splitting each interval across the days it spans. Meter resets (negative) are skipped. */
export function dailyUsage(readings: Reading[]) {
  const map: Record<string, number> = {};
  for (const iv of intervals(readings)) {
    if (iv.used < 0) continue;
    const start = iv.from.t, end = iv.to.t;
    if (end <= start) { map[dayKey(start)] = (map[dayKey(start)] || 0) + iv.used; continue; }
    const total = end - start;
    let cur = start;
    while (cur < end) {
      const d = new Date(cur); d.setHours(24, 0, 0, 0);
      const segEnd = Math.min(d.getTime(), end);
      map[dayKey(cur)] = (map[dayKey(cur)] || 0) + (iv.used * (segEnd - cur)) / total;
      cur = segEnd;
    }
  }
  return Object.keys(map).sort().map((day) => ({ day, used: map[day] }));
}

/** One zero-filled value per day across the whole range; newest `n` days when given. */
export function continuousDaily(readings: Reading[], n?: number) {
  const raw = dailyUsage(readings);
  if (!raw.length) return [];
  const map: Record<string, number> = {};
  raw.forEach((d) => (map[d.day] = d.used));
  const out: { day: string; used: number }[] = [];
  for (let d = parseIso(raw[0].day), end = parseIso(raw[raw.length - 1].day); d <= end; d.setDate(d.getDate() + 1)) {
    const key = isoDate(d);
    out.push({ day: key, used: map[key] || 0 });
  }
  return n ? out.slice(-n) : out;
}

/** Meter value at `ms`: snaps to a reading within ~30h (so a reading on the billing day defines the cycle), else interpolates. */
export function meterAt(readings: Reading[], ms: number) {
  const r = sortReadings(readings);
  if (!r.length) return null;
  const TOL = 30 * 3600 * 1000;
  let best: Reading | null = null, bd = Infinity;
  for (const x of r) { const d = Math.abs(x.t - ms); if (d < bd) { bd = d; best = x; } }
  if (best && bd <= TOL) return best.v;
  if (ms <= r[0].t) return r[0].v;
  if (ms >= r[r.length - 1].t) return r[r.length - 1].v;
  for (let i = 1; i < r.length; i++) {
    if (r[i].t >= ms) { const a = r[i - 1], b = r[i]; return a.v + ((b.v - a.v) * (ms - a.t)) / (b.t - a.t); }
  }
  return r[r.length - 1].v;
}

export function unitsBetween(readings: Reading[], startMs: number, endMs: number) {
  const a = meterAt(readings, startMs), b = meterAt(readings, endMs);
  return a == null || b == null ? 0 : b - a;
}

/** Every billing-cycle window the readings span, newest first. */
export function cycleWindows(readings: Reading[], billDay: number) {
  const r = sortReadings(readings);
  if (r.length < 2) return [];
  const last = r[r.length - 1].t;
  let { start } = cycleBounds(new Date(r[0].t), billDay);
  const out: { start: Date; end: Date }[] = [];
  while (start.getTime() < last) {
    const { end } = cycleBounds(start, billDay);
    out.push({ start: new Date(start), end: new Date(end) });
    start = new Date(end);
  }
  return out.reverse();
}

/** Fully past cycles with reading-based units, newest first. */
export function completedCycles(readings: Reading[], billDay: number, now = Date.now()) {
  return cycleWindows(readings, billDay)
    .filter((w) => w.end.getTime() <= now)
    .map((w) => ({ ...w, units: unitsBetween(readings, +w.start, +w.end) }));
}

export function stats(readings: Reading[], s: PowerSettings, nowDate = new Date()) {
  const r = sortReadings(readings);
  if (r.length < 2) return null;
  const ivs = intervals(r);
  const daily = dailyUsage(r);
  const { start, end } = cycleBounds(nowDate, s.billDay);
  const cycleUsed = Math.max(unitsBetween(r, +start, r[r.length - 1].t), 0);
  const daysInCycle = (+end - +start) / D;
  const daysElapsed = Math.max((+nowDate - +start) / D, 0.5);
  const projected = (cycleUsed / daysElapsed) * daysInCycle;
  const totalUsed = ivs.filter((i) => i.used >= 0).reduce((a, i) => a + i.used, 0);
  const spanDays = (r[r.length - 1].t - r[0].t) / D;
  const peak = [...daily].sort((a, b) => b.used - a.used)[0] || null;
  return {
    cycleStart: start, cycleEnd: end, cycleUsed, projected, daysInCycle, daysElapsed: Math.min(daysElapsed, daysInCycle),
    billSoFar: cycleUsed * s.rate, projectedBill: projected * s.rate,
    perDay: spanDays > 0 ? totalUsed / spanDays : 0, spanDays, peak, last: r[r.length - 1], count: r.length,
  };
}

export const applianceKwh = (a: Appliance) => (a.watts * a.qty * a.hours) / 1000;

export function applianceBreakdown(list: Appliance[]) {
  const rows = list.map((a) => ({ ...a, kwh: applianceKwh(a) })).sort((x, y) => y.kwh - x.kwh);
  return { rows, totalPerDay: rows.reduce((s, x) => s + x.kwh, 0) };
}

/** How far the estimated bills were from the actual ones (cycles with an actual bill only). */
export function estimateAccuracy(cycles: Cycle[]) {
  const w = cycles.filter((c) => c.actual != null && c.actual > 0 && c.est > 0);
  if (!w.length) return null;
  const avgErrPct = (w.reduce((s, c) => s + Math.abs(c.actual! - c.est) / c.actual!, 0) / w.length) * 100;
  const bias = w.reduce((s, c) => s + (c.actual! - c.est), 0); // > 0: estimates were too low
  return { count: w.length, avgErrPct, bias };
}
