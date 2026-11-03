/**
 * Pure garage logic: fuel average, odometer tracking, maintenance reminders,
 * running costs and rule-based insights. Distances in km, volume in litres.
 */

export type VehicleKind = "car" | "bike" | "other";
export type FuelType = "petrol" | "diesel" | "hybrid" | "cng";

export interface Vehicle {
  id: string;
  name: string;
  kind: VehicleKind;
  make: string;
  model: string;
  year: number | null;
  plate: string;
  fuelType: FuelType;
  tankLitres: number | null;
  startOdo: number; // odometer when added
  createdAt: number;
}
export interface FuelLog { id: string; vehicleId: string; date: string; odo: number; litres: number; cost: number; full: boolean; station: string; createdAt: number }
export interface OdoLog { id: string; vehicleId: string; date: string; odo: number; note: string; createdAt: number }
export interface ServiceLog { id: string; vehicleId: string; date: string; odo: number | null; title: string; cost: number; workshop: string; note: string; createdAt: number }
export interface Reminder {
  id: string;
  vehicleId: string;
  title: string;
  kind: "service" | "document";
  intervalKm: number | null;
  intervalMonths: number | null;
  lastDate: string | null;
  lastOdo: number | null;
  dueDate: string | null;
  dueOdo: number | null;
  createdAt: number;
}

export const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: "petrol", label: "Petrol" }, { value: "diesel", label: "Diesel" }, { value: "hybrid", label: "Hybrid" }, { value: "cng", label: "CNG" },
];
export const kindEmoji = (k: VehicleKind) => (k === "bike" ? "🏍️" : k === "car" ? "🚗" : "🛻");

/** Common starting points; intervals vary by vehicle, so they stay editable. */
export const REMINDER_PRESETS: { title: string; kind: Reminder["kind"]; intervalKm: number | null; intervalMonths: number | null; emoji: string }[] = [
  { title: "Engine oil & filter", kind: "service", intervalKm: 5000, intervalMonths: 6, emoji: "🛢️" },
  { title: "Air filter", kind: "service", intervalKm: 15000, intervalMonths: 12, emoji: "💨" },
  { title: "AC service", kind: "service", intervalKm: null, intervalMonths: 12, emoji: "❄️" },
  { title: "Tyre rotation & balancing", kind: "service", intervalKm: 10000, intervalMonths: null, emoji: "🛞" },
  { title: "Brake inspection", kind: "service", intervalKm: 20000, intervalMonths: 12, emoji: "🛑" },
  { title: "Spark plugs", kind: "service", intervalKm: 30000, intervalMonths: null, emoji: "⚡" },
  { title: "Coolant", kind: "service", intervalKm: 40000, intervalMonths: 24, emoji: "🌡️" },
  { title: "Battery check", kind: "service", intervalKm: null, intervalMonths: 12, emoji: "🔋" },
  { title: "Insurance renewal", kind: "document", intervalKm: null, intervalMonths: 12, emoji: "🛡️" },
  { title: "Token tax", kind: "document", intervalKm: null, intervalMonths: 12, emoji: "📄" },
];

const D = 86400000;
const p2 = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a: string, b: string) => Math.round((+parse(b) - +parse(a)) / D);
export function addMonthsIso(iso: string, months: number) {
  const d = parse(iso), day = d.getDate();
  const x = new Date(d.getFullYear(), d.getMonth() + months, 1);
  x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return isoDay(x);
}
const addDaysIso = (iso: string, n: number) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoDay(d); };

/* ---------- odometer ---------- */
export interface OdoPoint { date: string; odo: number }

export function odoPoints(v: Vehicle, fuel: FuelLog[], odo: OdoLog[], service: ServiceLog[]): OdoPoint[] {
  const pts: OdoPoint[] = [
    ...fuel.map((f) => ({ date: f.date, odo: f.odo })),
    ...odo.map((o) => ({ date: o.date, odo: o.odo })),
    ...service.filter((s) => s.odo != null).map((s) => ({ date: s.date, odo: s.odo as number })),
  ];
  pts.sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
  // the odometer at setup is the first point, unless older logs were back-filled below it
  if (!pts.length || v.startOdo <= pts[0].odo) {
    const added = isoDay(new Date(v.createdAt));
    pts.unshift({ date: pts[0] && pts[0].date < added ? pts[0].date : added, odo: v.startOdo });
  }
  return pts;
}

export const currentOdo = (pts: OdoPoint[]) => pts.reduce((m, p) => Math.max(m, p.odo), 0);

/** Average km per day from recent readings (last 180 days, at least a week of span), else all history. */
export function kmPerDay(pts: OdoPoint[], today: string) {
  if (pts.length < 2) return null;
  const recent = pts.filter((p) => daysBetween(p.date, today) <= 180);
  for (const set of [recent, pts]) {
    if (set.length < 2) continue;
    const span = daysBetween(set[0].date, set[set.length - 1].date);
    const km = set[set.length - 1].odo - set[0].odo;
    if (span >= 7 && km >= 0) return km / span;
  }
  return null;
}

/** An odometer can't run backwards: flags a reading lower than an earlier one, or higher than a later one. */
export function odoConflict(date: string, odo: number, pts: OdoPoint[]) {
  let before: OdoPoint | null = null, after: OdoPoint | null = null;
  for (const p of pts) {
    if (p.date <= date && (!before || p.odo > before.odo)) before = p;
    if (p.date > date && (!after || p.odo < after.odo)) after = p;
  }
  if (before && odo < before.odo) return `Lower than ${before.odo.toLocaleString()} km logged on ${before.date}.`;
  if (after && odo > after.odo) return `Higher than ${after.odo.toLocaleString()} km logged later, on ${after.date}.`;
  return null;
}

/* ---------- fuel average (full-tank to full-tank) ---------- */
export interface FuelSegment { date: string; km: number; litres: number; cost: number; kmpl: number; logId: string }

export function sortFuel(logs: FuelLog[]) {
  return [...logs].sort((a, b) => a.odo - b.odo || a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

/**
 * Consumption can only be measured between two full tanks: the second fill
 * replaces what was burned since the first. Partial fills in between add to
 * the litres of the next full fill.
 */
export function fuelSegments(logs: FuelLog[]): FuelSegment[] {
  const out: FuelSegment[] = [];
  let prevFull: FuelLog | null = null, litres = 0, cost = 0;
  for (const f of sortFuel(logs)) {
    if (!prevFull) { if (f.full) prevFull = f; continue; }
    litres += f.litres; cost += f.cost;
    if (f.full) {
      const km = f.odo - prevFull.odo;
      if (km > 0 && litres > 0) out.push({ date: f.date, km, litres, cost, kmpl: km / litres, logId: f.id });
      prevFull = f; litres = 0; cost = 0;
    }
  }
  return out;
}

export function fuelStats(logs: FuelLog[]) {
  const seg = fuelSegments(logs);
  const totalLitres = logs.reduce((s, f) => s + f.litres, 0);
  const totalCost = logs.reduce((s, f) => s + f.cost, 0);
  const km = seg.reduce((s, x) => s + x.km, 0), segLitres = seg.reduce((s, x) => s + x.litres, 0), segCost = seg.reduce((s, x) => s + x.cost, 0);
  const byDate = [...logs].sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
  const lastFill = byDate[byDate.length - 1] || null;
  const kmpls = seg.map((s) => s.kmpl);
  return {
    segments: seg,
    fills: logs.length,
    totalLitres,
    totalCost,
    avgKmpl: segLitres > 0 ? km / segLitres : null, // distance-weighted, not a mean of means
    lastKmpl: seg.length ? seg[seg.length - 1].kmpl : null,
    bestKmpl: kmpls.length ? Math.max(...kmpls) : null,
    worstKmpl: kmpls.length ? Math.min(...kmpls) : null,
    fuelCostPerKm: km > 0 ? segCost / km : null,
    avgPrice: totalLitres > 0 ? totalCost / totalLitres : null,
    lastPrice: lastFill && lastFill.litres > 0 ? lastFill.cost / lastFill.litres : null,
    lastFill,
  };
}

/** Fuel spend per calendar month, oldest first, including empty months. */
export function fuelByMonth(logs: FuelLog[], months: number, today: string) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(y, m - 1 - (months - 1 - i), 1);
    const key = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    const rows = logs.filter((f) => f.date.startsWith(key));
    return { key, label: d.toLocaleDateString(undefined, { month: "short" }), cost: rows.reduce((s, f) => s + f.cost, 0), litres: rows.reduce((s, f) => s + f.litres, 0) };
  });
}

/* ---------- maintenance ---------- */
export type DueStatus = "overdue" | "soon" | "ok" | "unset";

/** Service due by whichever of date or odometer comes first. */
export function reminderStatus(r: Reminder, odo: number, perDay: number | null, today: string) {
  const kmLeft = r.dueOdo != null ? r.dueOdo - odo : null;
  const daysLeft = r.dueDate != null ? daysBetween(today, r.dueDate) : null;
  // when the km limit will probably be reached at the current driving rate
  const kmDays = kmLeft != null && perDay && perDay > 0 ? Math.round(kmLeft / perDay) : null;
  const candidates = [daysLeft, kmDays].filter((x): x is number => x != null);
  const effectiveDays = candidates.length ? Math.min(...candidates) : null;
  const predictedDate = effectiveDays != null ? addDaysIso(today, effectiveDays) : null;

  let status: DueStatus;
  if (kmLeft == null && daysLeft == null) status = "unset";
  else if ((kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0)) status = "overdue";
  else if ((daysLeft != null && daysLeft <= 30) || (kmLeft != null && kmLeft <= (r.intervalKm ? Math.max(300, r.intervalKm * 0.1) : 500)) || (kmDays != null && kmDays <= 14)) status = "soon";
  else status = "ok";

  // how much of the interval is used up (the more advanced of km and time)
  const parts: number[] = [];
  if (r.dueOdo != null && r.lastOdo != null && r.dueOdo > r.lastOdo) parts.push((odo - r.lastOdo) / (r.dueOdo - r.lastOdo));
  if (r.dueDate != null && r.lastDate != null && r.dueDate > r.lastDate) parts.push(daysBetween(r.lastDate, today) / daysBetween(r.lastDate, r.dueDate));
  const used = parts.length ? Math.max(0, Math.min(1, Math.max(...parts))) : null;

  return { status, kmLeft, daysLeft, predictedDate, effectiveDays, used };
}

/** After the work is done: records it and rolls the next due point forward by the interval. */
export function advanceReminder(r: Reminder, date: string, odo: number | null): Pick<Reminder, "lastDate" | "lastOdo" | "dueDate" | "dueOdo"> {
  return {
    lastDate: date,
    lastOdo: odo ?? r.lastOdo,
    dueDate: r.intervalMonths ? addMonthsIso(date, r.intervalMonths) : null,
    dueOdo: r.intervalKm && odo != null ? odo + r.intervalKm : null,
  };
}

export function sortReminders(a: ReturnType<typeof reminderStatus>, b: ReturnType<typeof reminderStatus>) {
  const rank: Record<DueStatus, number> = { overdue: 0, soon: 1, ok: 2, unset: 3 };
  return rank[a.status] - rank[b.status] || (a.effectiveDays ?? 1e9) - (b.effectiveDays ?? 1e9);
}

/* ---------- running costs ---------- */
export function runningCosts(fuel: FuelLog[], service: ServiceLog[], pts: OdoPoint[], today: string) {
  const fuelCost = fuel.reduce((s, f) => s + f.cost, 0), serviceCost = service.reduce((s, x) => s + x.cost, 0);
  const total = fuelCost + serviceCost;
  const km = pts.length >= 2 ? currentOdo(pts) - Math.min(...pts.map((p) => p.odo)) : 0;
  const dates = [...fuel.map((f) => f.date), ...service.map((s) => s.date)].sort();
  const months = dates.length ? Math.max(1, daysBetween(dates[0], today) / 30.44) : null;
  return { fuelCost, serviceCost, total, km, perKm: km > 0 && total > 0 ? total / km : null, perMonth: months ? total / months : null };
}

/* ---------- rule-based insights ---------- */
export interface Insight { tone: "warn" | "good" | "info"; title: string; detail: string }

export function vehicleInsights(input: { fuel: FuelLog[]; service: ServiceLog[]; reminders: Reminder[]; tankLitres: number | null; odo: number; perDay: number | null; today: string }): Insight[] {
  const { fuel, reminders, tankLitres, perDay, odo } = input;
  const out: Insight[] = [];
  const s = fuelStats(fuel), seg = s.segments;

  if (seg.length >= 5 && s.avgKmpl) {
    const recent = seg.slice(-3), km = recent.reduce((a, x) => a + x.km, 0), l = recent.reduce((a, x) => a + x.litres, 0);
    const recentAvg = km / l, change = recentAvg / s.avgKmpl - 1;
    if (change <= -0.1) out.push({ tone: "warn", title: `Fuel average down ${Math.round(-change * 100)}%`, detail: `Last 3 tanks: ${recentAvg.toFixed(1)} km/l vs ${s.avgKmpl.toFixed(1)} overall. Check tyre pressure and air filter; AC use and traffic also play a part.` });
    else if (change >= 0.1) out.push({ tone: "good", title: `Fuel average up ${Math.round(change * 100)}%`, detail: `Last 3 tanks: ${recentAvg.toFixed(1)} km/l vs ${s.avgKmpl.toFixed(1)} overall.` });
  }
  if (fuel.length >= 1 && seg.length === 0) {
    out.push({ tone: "info", title: "Fuel average needs two full tanks", detail: "Fill to full and log it, then do the same next time. Partial fills in between are counted automatically." });
  }
  if (s.lastPrice && s.avgPrice && fuel.length >= 4 && s.lastPrice / s.avgPrice - 1 >= 0.05) {
    out.push({ tone: "info", title: "Fuel is pricier than your average", detail: `Last fill Rs ${s.lastPrice.toFixed(1)}/L vs Rs ${s.avgPrice.toFixed(1)}/L on average.` });
  }
  if (tankLitres && s.avgKmpl && s.lastFill) {
    const range = Math.round(tankLitres * s.avgKmpl);
    if (perDay && perDay > 0) out.push({ tone: "info", title: `About ${range.toLocaleString()} km on a full tank`, detail: `At ${Math.round(perDay)} km/day that's a fill roughly every ${Math.max(1, Math.round(range / perDay))} days.` });
    else out.push({ tone: "info", title: `About ${range.toLocaleString()} km on a full tank`, detail: "Based on your tank size and fuel average." });
  }
  if (!reminders.some((r) => r.kind === "service")) {
    out.push({ tone: "info", title: "No service reminders yet", detail: "Add engine oil first; it's the one most worth not missing." });
  }
  if (!reminders.some((r) => r.kind === "document")) {
    out.push({ tone: "info", title: "Track insurance and token tax", detail: "Add their expiry dates so renewals don't catch you out." });
  }
  if (odo > 0 && perDay && perDay > 0) out.push({ tone: "info", title: `About ${Math.round(perDay * 30.44).toLocaleString()} km a month`, detail: "Your recent driving rate, used to predict when km-based service falls due." });
  return out;
}

/* ---------- fuel CSV import ---------- */
export interface FuelImportRow { date: string; odo: number; litres: number; cost: number; full: boolean; station: string }

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const s = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows;
}

const validDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDay(parse(s)) === s;

/** Reads the Logbook's own CSV format. Column order doesn't matter; bad rows are reported, not guessed at. */
export function parseFuelCsv(text: string) {
  const rows = csvRows(text);
  const head = (rows[0] || []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.findIndex((h) => h.startsWith(name));
  const c = { date: col("date"), odo: col("odometer"), litres: col("litres"), cost: col("cost"), price: col("rs per litre"), full: col("full"), station: col("station") };
  if (c.date < 0 || c.odo < 0 || c.litres < 0 || (c.cost < 0 && c.price < 0)) {
    return { rows: [] as FuelImportRow[], errors: [{ line: 1, message: "Expected columns: Date, Odometer (km), Litres, and Cost (Rs) or Rs per litre." }] };
  }
  const num = (v: string | undefined) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : NaN; };
  const YES = ["yes", "y", "true", "1", "full"], NO = ["no", "n", "false", "0", "partial"];
  const out: FuelImportRow[] = [], errors: { line: number; message: string }[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (r.every((x) => !x.trim())) return;
    const date = (r[c.date] || "").trim(), odo = num(r[c.odo]), litres = num(r[c.litres]);
    const price = c.price >= 0 ? num(r[c.price]) : NaN;
    let cost = c.cost >= 0 ? num(r[c.cost]) : NaN;
    if (!Number.isFinite(cost) && price > 0 && litres > 0) cost = Math.round(price * litres * 100) / 100;
    const fullRaw = c.full >= 0 ? (r[c.full] || "").trim().toLowerCase() : "yes";
    if (!validDay(date)) errors.push({ line, message: `Invalid date "${date}" (use YYYY-MM-DD).` });
    else if (!(odo >= 0)) errors.push({ line, message: "Invalid odometer." });
    else if (!(litres > 0)) errors.push({ line, message: "Invalid litres." });
    else if (!(cost >= 0)) errors.push({ line, message: "Invalid cost." });
    else if (![...YES, ...NO].includes(fullRaw)) errors.push({ line, message: `Unclear full-tank value "${fullRaw}" (use yes or no).` });
    else out.push({ date, odo, litres, cost, full: YES.includes(fullRaw), station: c.station >= 0 ? (r[c.station] || "").trim().slice(0, 60) : "" });
  });
  return { rows: out, errors };
}

/** Works out what's safe to add: skips fill-ups already logged and readings that would run the odometer backwards. */
export function planFuelImport(rows: FuelImportRow[], existing: FuelLog[], logged: OdoPoint[]) {
  const toAdd: FuelImportRow[] = [], duplicates: FuelImportRow[] = [], conflicts: { row: FuelImportRow; message: string }[] = [];
  const seen = new Set(existing.map((f) => `${f.date}|${f.odo}`));
  const pts = [...logged];
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo)) {
    const key = `${r.date}|${r.odo}`;
    if (seen.has(key)) { duplicates.push(r); continue; }
    const message = odoConflict(r.date, r.odo, pts);
    if (message) { conflicts.push({ row: r, message }); continue; }
    seen.add(key); pts.push({ date: r.date, odo: r.odo }); toAdd.push(r);
  }
  return { toAdd, duplicates, conflicts };
}
