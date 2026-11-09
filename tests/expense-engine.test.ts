import { describe, expect, test } from "vitest";
import {
  accountTotals, bucketSummary, byCategory, calculatePF, categoryColor, categoryEmoji, countsInExpenses, filterTxns, separateBucketIds, groupByDay, monthRange, parseDebtPayment,
  parseDebtTitle, shiftMonth, toCSV, totals, type Account, type ExpenseTxn,
  AUTO_BANK, NO_BANK, applyMoves, orderBanks, planBankMoves, sourceOf,
} from "../src/engine/expense-engine";

const tx = (p: Partial<ExpenseTxn>): ExpenseTxn => ({
  id: Math.random().toString(36).slice(2), txn_date: "2026-07-01", description: "x", amount: 0,
  category: null, direction: "OUT", created_at: 0, ...p,
});
const acc = (kind: Account["kind"], balance: number): Account => ({ id: kind + balance, name: kind, kind, balance, sort_order: 0, created_at: 0 });

describe("expense engine", () => {
  test("totals and savings rate", () => {
    const t = totals([tx({ direction: "IN", amount: 1000 }), tx({ amount: 300 }), tx({ amount: 200 })]);
    expect(t).toEqual({ income: 1000, expenses: 500, net: 500, savingsRate: 50 });
    expect(totals([tx({ amount: 5 })]).savingsRate).toBeNull();
  });

  test("category breakdown ignores income and sorts descending", () => {
    const r = byCategory([tx({ direction: "IN", amount: 99 }), tx({ amount: 10, category: "Transport" }), tx({ amount: 30, category: "Food & Groceries" }), tx({ amount: 5, category: "Transport" })]);
    expect(r).toEqual([{ category: "Food & Groceries", amount: 30 }, { category: "Transport", amount: 15 }]);
  });

  test("net worth subtracts debts", () => {
    expect(accountTotals([acc("asset", 100), acc("bank", 50), acc("debt", 30)])).toEqual({ assets: 100, banks: 50, debts: 30, net: 120 });
  });

  test("debt titles", () => {
    expect(parseDebtTitle("Debt - Car loan")).toBe("Car loan");
    expect(parseDebtTitle("debt:Ali")).toBe("Ali");
    expect(parseDebtTitle("Groceries")).toBeNull();
    expect(parseDebtPayment("Debt paid - Car loan")).toBe("Car loan");
    expect(parseDebtPayment("Debt repayment: Ali")).toBe("Ali");
    expect(parseDebtPayment("Debt - Ali")).toBeNull();
  });

  test("month helpers wrap years", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  test("filter + group", () => {
    const list = [tx({ description: "Rent", category: "Housing & Utilities", txn_date: "2026-07-01" }), tx({ description: "Salary", direction: "IN", txn_date: "2026-07-03" })];
    expect(filterTxns(list, "rent", "")).toHaveLength(1);
    expect(filterTxns(list, "", "__income__")[0].description).toBe("Salary");
    expect(groupByDay(list).map((g) => g.day)).toEqual(["2026-07-03", "2026-07-01"]);
  });

  test("bucket filter and summary span months", () => {
    const list = [
      tx({ amount: 100, category: "Transport", bucket: "u", txn_date: "2026-09-10" }),
      tx({ amount: 50, category: "Housing & Utilities", bucket: "u", txn_date: "2026-11-01" }),
      tx({ amount: 20, direction: "IN", bucket: "u", txn_date: "2026-10-05" }),
      tx({ amount: 999, category: "Transport" }),
    ];
    expect(filterTxns(list, "", "", "u")).toHaveLength(3);
    expect(filterTxns(list, "", "", "__none__")).toHaveLength(1);
    const s = bucketSummary(list, "u");
    expect(s).toMatchObject({ count: 3, spent: 150, received: 20, net: 130, first: "2026-09-10", last: "2026-11-01" });
    expect(s.categories).toEqual([{ category: "Transport", amount: 100 }, { category: "Housing & Utilities", amount: 50 }]);
    expect(bucketSummary(list, "nope")).toMatchObject({ count: 0, net: 0, first: null });
  });

  test("separate-ledger buckets stay out of spending totals", () => {
    const b = (id: string, in_expenses?: boolean) => ({ id, name: id, emoji: "", color: "", budget: null, status: "active" as const, created_at: 0, in_expenses });
    const separate = separateBucketIds([b("umrah", false), b("wedding", true), b("old")]);
    expect([...separate]).toEqual(["umrah"]);
    const list = [tx({ amount: 100 }), tx({ amount: 500, bucket: "umrah" }), tx({ amount: 40, bucket: "wedding" }), tx({ amount: 7, bucket: "old" })];
    expect(totals(list.filter((t) => countsInExpenses(t, separate))).expenses).toBe(147);
    // The bucket's own total still includes everything tagged to it.
    expect(bucketSummary(list, "umrah").spent).toBe(500);
  });

  test("category helpers use the user's list, with a fallback", () => {
    const cats = [{ key: "Umrah", emoji: "🕋", color: "#123456" }];
    expect(categoryEmoji("Umrah", cats)).toBe("🕋");
    expect(categoryColor("Transport", cats)).toBe("#94a3b8");
    expect(categoryEmoji("Transport")).toBe("🚗");
  });

  test("CSV escapes quotes", () => {
    expect(toCSV([tx({ description: 'A "b"', amount: 5, category: "Transport" })]).split("\n")[1]).toBe('2026-07-01,"A ""b""","Transport",OUT,5');
  });

  test("PF calculator: no growth, no tax is plain contributions", () => {
    const r = calculatePF({ initialBalance: 0, empMonthly: 100, employerMonthly: 100, years: 2, annualRatePct: 0, annualIncrementPct: 0, taxEnabled: false, taxRatePct: 10, taxScope: "interest" });
    expect(r.grossMaturity).toBe(4800);
    expect(r.netMaturity).toBe(4800);
    expect(r.schedule).toHaveLength(2);
  });

  test("PF calculator taxes interest only", () => {
    const r = calculatePF({ initialBalance: 1000, empMonthly: 0, employerMonthly: 0, years: 1, annualRatePct: 12, annualIncrementPct: 0, taxEnabled: true, taxRatePct: 10, taxScope: "interest" });
    expect(r.totalInterest).toBeCloseTo(1000 * (Math.pow(1.01, 12) - 1), 6);
    expect(r.taxDeduction).toBeCloseTo(r.totalInterest * 0.1, 6);
  });
});

describe("auto-deduct from bank accounts", () => {
  const bank = (id: string, balance: number, sort_order = 0): Account => ({ id, name: id, kind: "bank", balance, sort_order, created_at: 0 });
  const banks = [bank("A", 1000, 0), bank("B", 500, 1), bank("C", 0, 2)];

  test("orderBanks follows the priority list, then Net Worth order, banks only", () => {
    const all = [...banks, { ...bank("X", 9), kind: "asset" as const }];
    expect(orderBanks(all, ["B"]).map((b) => b.id)).toEqual(["B", "A", "C"]);
    expect(orderBanks(all, ["C", "gone", "A"]).map((b) => b.id)).toEqual(["C", "A", "B"]);
    expect(orderBanks(all).map((b) => b.id)).toEqual(["A", "B", "C"]);
  });

  test("spending drains banks in order and overdraws the top one when all are empty", () => {
    expect(planBankMoves(300, "OUT", banks)).toEqual({ A: -300 });
    expect(planBankMoves(1200, "OUT", banks)).toEqual({ A: -1000, B: -200 });
    expect(planBankMoves(1800, "OUT", banks)).toEqual({ A: -1300, B: -500 });
    expect(planBankMoves(50, "OUT", [bank("A", -10), bank("B", 20)])).toEqual({ A: -30, B: -20 });
  });

  test("income goes to the top bank; a picked bank or none overrides", () => {
    expect(planBankMoves(400, "IN", banks)).toEqual({ A: 400 });
    expect(planBankMoves(2000, "OUT", banks, "C")).toEqual({ C: -2000 });
    expect(planBankMoves(400, "IN", banks, "B")).toEqual({ B: 400 });
    expect(planBankMoves(400, "OUT", banks, NO_BANK)).toEqual({});
    expect(planBankMoves(400, "OUT", banks, "deleted-bank")).toEqual({ A: -400 });
    expect(planBankMoves(0, "OUT", banks)).toEqual({});
    expect(planBankMoves(10, "OUT", [])).toEqual({});
  });

  test("applyMoves applies and undoes, ignoring removed accounts", () => {
    const moves = { A: -1000, B: -200, gone: -5 };
    const after = applyMoves(banks, moves);
    expect(after.map((b) => b.balance)).toEqual([0, 300, 0]);
    expect(applyMoves(after, moves, -1).map((b) => b.balance)).toEqual([1000, 500, 0]);
    expect(applyMoves(banks, null)).toBe(banks);
  });

  test("sourceOf picks the bank, auto when split, none when untouched", () => {
    expect(sourceOf({ bank_moves: { A: -5 } })).toBe("A");
    expect(sourceOf({ bank_moves: { A: -5, B: -1 } })).toBe(AUTO_BANK);
    expect(sourceOf({ bank_moves: null })).toBe(NO_BANK);
    expect(sourceOf({})).toBe(NO_BANK);
  });
});
