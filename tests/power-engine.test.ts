import { describe, expect, test } from "vitest";
import {
  applianceBreakdown, completedCycles, continuousDaily, cycleBounds, dailyUsage, estimateAccuracy, meterAt, stats,
  type Cycle, type Reading,
} from "../src/engine/power-engine";

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();
const r = (id: string, v: number, t: number): Reading => ({ id, v, t });

describe("power engine", () => {
  test("cycle bounds clamp to short months and roll back before the billing day", () => {
    const a = cycleBounds(new Date(2026, 1, 10), 31); // Feb 10, bill day 31
    expect(a.start).toEqual(new Date(2026, 0, 31));
    expect(a.end).toEqual(new Date(2026, 1, 28));
    const b = cycleBounds(new Date(2026, 4, 3), 5); // May 3, bill day 5
    expect(b.start).toEqual(new Date(2026, 3, 5));
    expect(b.end).toEqual(new Date(2026, 4, 5));
  });

  test("daily usage splits an interval across midnight by time", () => {
    const d = dailyUsage([r("1", 100, at(2026, 3, 1, 18)), r("2", 112, at(2026, 3, 2, 6))]);
    expect(d).toHaveLength(2);
    expect(d[0].used).toBeCloseTo(6, 9);
    expect(d[1].used).toBeCloseTo(6, 9);
  });

  test("meter resets are ignored and gaps are zero-filled", () => {
    const list = [r("1", 100, at(2026, 3, 1, 12)), r("2", 110, at(2026, 3, 2, 12)), r("3", 5, at(2026, 3, 3, 12)), r("4", 15, at(2026, 3, 6, 12))];
    const c = continuousDaily(list);
    expect(c.map((x) => x.day)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]);
    expect(c.reduce((s, x) => s + x.used, 0)).toBeCloseTo(20, 9);
  });

  test("meterAt snaps near a reading, otherwise interpolates", () => {
    const list = [r("1", 0, at(2026, 1, 1)), r("2", 100, at(2026, 1, 11))];
    expect(meterAt(list, at(2026, 1, 1, 20))).toBe(0);
    expect(meterAt(list, at(2026, 1, 6))).toBeCloseTo(50, 9);
  });

  test("completed cycles use readings on the billing day", () => {
    const list = [r("1", 1000, at(2026, 1, 1, 9)), r("2", 1300, at(2026, 2, 1, 9)), r("3", 1550, at(2026, 3, 1, 9)), r("4", 1600, at(2026, 3, 8, 9))];
    const c = completedCycles(list, 1, at(2026, 3, 9));
    expect(c.map((x) => Math.round(x.units))).toEqual([250, 300]);
  });

  test("stats project the current cycle at its pace", () => {
    const list = [r("1", 1000, at(2026, 4, 1, 0)), r("2", 1100, at(2026, 4, 11, 0))];
    const s = stats(list, { rate: 50, billDay: 1, unit: "kWh" }, new Date(2026, 3, 11))!;
    expect(s.cycleUsed).toBe(100);
    expect(s.projected).toBeCloseTo(300, 9); // 10 days elapsed of a 30-day cycle
    expect(s.projectedBill).toBeCloseTo(15000, 6);
    expect(stats([list[0]], { rate: 50, billDay: 1, unit: "kWh" })).toBeNull();
  });

  test("appliances and estimate accuracy", () => {
    const b = applianceBreakdown([{ id: "a", name: "AC", watts: 1500, qty: 1, hours: 8 }, { id: "b", name: "Fan", watts: 75, qty: 4, hours: 10 }]);
    expect(b.rows[0].name).toBe("AC");
    expect(b.totalPerDay).toBeCloseTo(15, 9);
    const cy = (est: number, actual: number | null): Cycle => ({ id: String(est), start: "2026-01-01", end: "2026-02-01", units: 0, rate: 50, est, actual, actualUnits: null, actualReading: null });
    const a = estimateAccuracy([cy(9000, 10000), cy(11000, 10000), cy(5000, null)])!;
    expect(a.count).toBe(2);
    expect(a.avgErrPct).toBeCloseTo(10, 9);
    expect(a.bias).toBe(0);
  });
});
