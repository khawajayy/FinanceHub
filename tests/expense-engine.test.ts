import { describe, expect, test } from "vitest";
import {
  accountTotals, byCategory, calculatePF, filterTxns, groupByDay, monthRange, parseDebtPayment,
  parseDebtTitle, shiftMonth, toCSV, totals, type Account, type ExpenseTxn,
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
