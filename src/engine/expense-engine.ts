/**
 * Pure expense-tracker logic (ported from ExpenseTracker js/app.js).
 * No DOM / Firebase access so it can be unit-tested.
 */

export type Direction = "IN" | "OUT";
export type AccountKind = "asset" | "bank" | "debt";

export interface ExpenseTxn {
  id: string;
  txn_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string | null;
  direction: Direction;
  created_at: number; // ms
  bucket?: string | null; // Bucket id, optional
}

/** A temporary tag for spending that belongs together (a trip, a wedding, a move). */
export interface Bucket {
  id: string;
  name: string;
  emoji: string;
  color: string;
  budget: number | null;
  status: "active" | "closed";
  created_at: number;
  /** false = a separate ledger: its transactions stay out of monthly spending totals. Missing = true (older buckets). */
  in_expenses?: boolean;
}

/** Ids of buckets kept out of spending totals. */
export const separateBucketIds = (buckets: Bucket[]) => new Set(buckets.filter((b) => b.in_expenses === false).map((b) => b.id));
/** Whether a transaction counts towards income/expense totals. */
export const countsInExpenses = (t: ExpenseTxn, separate: Set<string>) => !t.bucket || !separate.has(t.bucket);

export interface Category { key: string; emoji: string; color: string }

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  balance: number;
  sort_order: number;
  created_at: number;
}

/** Defaults until the user edits their list in Settings. */
export const CATEGORIES: readonly Category[] = [
  { key: "Housing & Utilities", emoji: "🏠", color: "#60a5fa" },
  { key: "Food & Groceries", emoji: "🛒", color: "#34d399" },
  { key: "Outside Food (Takeaway/Dining Out)", emoji: "🍔", color: "#fbbf24" },
  { key: "Transport", emoji: "🚗", color: "#f472b6" },
  { key: "Health & Lifestyle", emoji: "💊", color: "#a78bfa" },
  { key: "Savings, Investment & Other", emoji: "📈", color: "#22d3ee" },
  { key: "Debt & Loans", emoji: "💸", color: "#f87171" },
];
/** Written by Repay on the Net Worth page, so it can't be renamed or removed. */
export const DEBT_CATEGORY = "Debt & Loans";

const findCat = (key: string | null | undefined, cats: readonly Category[]) => (key ? cats.find((c) => c.key === key) : undefined);
export const categoryEmoji = (key: string | null | undefined, cats: readonly Category[] = CATEGORIES) => findCat(key, cats)?.emoji || "🏷️";
export const categoryColor = (key: string | null | undefined, cats: readonly Category[] = CATEGORIES) => findCat(key, cats)?.color || "#94a3b8";

export const BUCKET_COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#fb923c", "#f87171"];

/** All-time totals for one bucket. Received money (refunds etc.) is shown apart from spending. */
export function bucketSummary(txns: ExpenseTxn[], bucketId: string) {
  const items = txns.filter((t) => t.bucket === bucketId);
  const { income: received, expenses: spent } = totals(items);
  const dates = items.map((t) => t.txn_date).sort();
  return { items, count: items.length, spent, received, net: spent - received, first: dates[0] || null, last: dates[dates.length - 1] || null, categories: byCategory(items) };
}

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const pad = (n: number) => String(n).padStart(2, "0");

export interface YearMonth { year: number; month: number } // month 1-12

export function currentMonth(now = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  let m = month + delta, y = year;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return { year: y, month: m };
}

export function monthRange({ year, month }: YearMonth) {
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
}

export const monthLabel = (ym: YearMonth) => `${MONTH_NAMES[ym.month - 1]} ${ym.year}`;
export const monthKey = (ym: YearMonth) => `${ym.year}-${pad(ym.month)}`;

export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today if it falls in the selected month, else the 1st of that month. */
export function defaultFormDate(ym: YearMonth, now = new Date()) {
  if (now.getFullYear() === ym.year && now.getMonth() + 1 === ym.month) return todayISO(now);
  return `${ym.year}-${pad(ym.month)}-01`;
}

export function inMonth(t: ExpenseTxn, ym: YearMonth) {
  const { start, end } = monthRange(ym);
  return t.txn_date >= start && t.txn_date <= end;
}

export function totals(txns: ExpenseTxn[]) {
  let income = 0, expenses = 0;
  for (const t of txns) {
    if (t.direction === "IN") income += Number(t.amount);
    else expenses += Number(t.amount);
  }
  const net = income - expenses;
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : null;
  return { income, expenses, net, savingsRate };
}

/** Expense totals per category, largest first. */
export function byCategory(txns: ExpenseTxn[]) {
  const m: Record<string, number> = {};
  for (const t of txns) {
    if (t.direction !== "OUT") continue;
    const key = t.category || "Uncategorised";
    m[key] = (m[key] || 0) + Number(t.amount);
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));
}

export function accountTotals(accounts: Account[]) {
  let assets = 0, banks = 0, debts = 0;
  for (const a of accounts) {
    if (a.kind === "asset") assets += Number(a.balance);
    else if (a.kind === "bank") banks += Number(a.balance);
    else if (a.kind === "debt") debts += Number(a.balance);
  }
  return { assets, banks, debts, net: assets + banks - debts };
}

/** `bucket`: "" = any, "__none__" = not in a bucket, else a bucket id. */
export function filterTxns(txns: ExpenseTxn[], query: string, category: string, bucket = "") {
  let list = txns;
  if (bucket === "__none__") list = list.filter((t) => !t.bucket);
  else if (bucket) list = list.filter((t) => t.bucket === bucket);
  const q = query.toLowerCase().trim();
  if (q) list = list.filter((t) => t.description.toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q));
  if (category === "__income__") list = list.filter((t) => t.direction === "IN");
  else if (category) list = list.filter((t) => t.direction === "OUT" && t.category === category);
  return list;
}

/** Groups by day, newest day first; rows within a day keep insertion order. */
export function groupByDay(txns: ExpenseTxn[]) {
  const groups: Record<string, ExpenseTxn[]> = {};
  for (const t of [...txns].sort((a, b) => a.created_at - b.created_at)) (groups[t.txn_date] ||= []).push(t);
  return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map((day) => ({ day, items: groups[day] }));
}

/** "Debt - Car loan" → "Car loan" (accepts ":" and dashes). */
export function parseDebtTitle(desc: string) {
  const m = String(desc).match(/^\s*debt\s*[-:–—]\s*(.+?)\s*$/i);
  return m && m[1] ? m[1].trim() : null;
}

/** "Debt paid - Car loan" (paid/repaid/payment/repayment) → "Car loan". */
export function parseDebtPayment(desc: string) {
  const m = String(desc).match(/^\s*debt\s+(?:paid|repaid|payment|repayment)\s*[-:–—]\s*(.+?)\s*$/i);
  return m && m[1] ? m[1].trim() : null;
}

export function findDebt(accounts: Account[], name: string) {
  return accounts.find((a) => a.kind === "debt" && a.name.trim().toLowerCase() === name.toLowerCase());
}

export const isProvidentFund = (a: Account) => a.kind === "asset" && /provident|pf\b/i.test(a.name);

/** One quoted CSV text cell. The leading ' stops spreadsheets running a value that starts like a formula. */
export function csvCell(value: string) {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCSV(txns: ExpenseTxn[]) {
  const header = "Date,Description,Category,Direction,Amount";
  const rows = [...txns].sort((a, b) => a.txn_date.localeCompare(b.txn_date) || a.created_at - b.created_at).map((t) => {
    const cat = t.direction === "IN" ? "Income" : t.category || "Uncategorised";
    return `${t.txn_date},${csvCell(t.description)},${csvCell(cat)},${t.direction},${t.amount}`;
  });
  return [header, ...rows].join("\n");
}

/* ---------- Provident Fund calculator ---------- */
export interface PFInput {
  initialBalance: number;
  empMonthly: number;
  employerMonthly: number;
  years: number;
  annualRatePct: number;
  annualIncrementPct: number;
  taxEnabled: boolean;
  taxRatePct: number;
  taxScope: "interest" | "total";
}

export interface PFYear { year: number; empContrib: number; employerContrib: number; interest: number; closingBalance: number; netAfterTax: number }

export function calculatePF(i: PFInput) {
  const initialBalance = Math.max(0, i.initialBalance || 0);
  const empMonthly = Math.max(0, i.empMonthly || 0);
  const employerMonthly = Math.max(0, i.employerMonthly || 0);
  const years = Math.max(1, Math.min(50, Math.round(i.years) || 15));
  const annualRate = Math.max(0, i.annualRatePct || 0) / 100;
  const annualIncrement = Math.max(0, i.annualIncrementPct || 0) / 100;
  const taxRate = i.taxEnabled ? Math.max(0, i.taxRatePct || 0) / 100 : 0;
  const monthlyRate = annualRate / 12;

  let bal = initialBalance, totEmp = 0, totEr = 0, totInt = 0;
  const schedule: PFYear[] = [];
  for (let y = 1; y <= years; y++) {
    const g = Math.pow(1 + annualIncrement, y - 1);
    const yEmp = empMonthly * g, yEr = employerMonthly * g;
    let ye = 0, yr = 0, yi = 0;
    for (let m = 1; m <= 12; m++) {
      bal += yEmp + yEr; ye += yEmp; yr += yEr;
      const mi = bal * monthlyRate; bal += mi; yi += mi;
    }
    totEmp += ye; totEr += yr; totInt += yi;
    const yearTax = i.taxEnabled ? (i.taxScope === "interest" ? totInt * taxRate : bal * taxRate) : 0;
    schedule.push({ year: y, empContrib: ye, employerContrib: yr, interest: yi, closingBalance: bal, netAfterTax: Math.max(0, bal - yearTax) });
  }
  const grossMaturity = bal;
  const taxDeduction = i.taxEnabled ? (i.taxScope === "interest" ? totInt * taxRate : grossMaturity * taxRate) : 0;
  return {
    initialBalance, totalEmployeeContrib: totEmp, totalEmployerContrib: totEr, totalInterest: totInt,
    grossMaturity, taxDeduction, netMaturity: Math.max(0, grossMaturity - taxDeduction),
    taxEnabled: i.taxEnabled, taxRate, schedule,
  };
}
