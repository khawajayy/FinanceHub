import { describe, expect, test } from "vitest";
import {
  addMonthsIso, advanceReminder, currentOdo, fuelByMonth, fuelSegments, fuelStats, kmPerDay, odoConflict, odoPoints, parseFuelCsv, partialEstimates, planFuelImport, reminderStatus, runningCosts, vehicleInsights,
  type FuelLog, type Reminder, type ServiceLog, type Vehicle,
} from "../src/engine/garage-engine";

let n = 0;
const fill = (date: string, odo: number, litres: number, cost: number, full = true): FuelLog => ({ id: `f${++n}`, vehicleId: "v", date, odo, litres, cost, full, station: "", createdAt: n });
const svc = (date: string, odo: number | null, cost: number): ServiceLog => ({ id: `s${++n}`, vehicleId: "v", date, odo, title: "Oil", cost, workshop: "", note: "", createdAt: n });
const vehicle: Vehicle = { id: "v", name: "Passo", kind: "car", make: "", model: "", year: null, plate: "", fuelType: "petrol", tankLitres: 40, startOdo: 1000, createdAt: new Date(2026, 0, 1).getTime() };
const rem = (p: Partial<Reminder>): Reminder => ({ id: "r", vehicleId: "v", title: "Oil", kind: "service", intervalKm: null, intervalMonths: null, lastDate: null, lastOdo: null, dueDate: null, dueOdo: null, createdAt: 0, ...p });

describe("fuel average", () => {
  test("measures full tank to full tank", () => {
    const seg = fuelSegments([fill("2026-01-01", 1000, 30, 9000), fill("2026-01-10", 1400, 25, 7500)]);
    expect(seg).toHaveLength(1);
    expect(seg[0]).toMatchObject({ km: 400, litres: 25, kmpl: 16, cost: 7500 });
  });

  test("the first fill is only a baseline, and partial fills roll into the next full one", () => {
    const seg = fuelSegments([
      fill("2026-01-01", 1000, 10, 3000, false), // before any full tank: ignored
      fill("2026-01-02", 1100, 30, 9000),
      fill("2026-01-10", 1300, 10, 3000, false),
      fill("2026-01-20", 1700, 30, 9000),
    ]);
    expect(seg).toHaveLength(1);
    expect(seg[0]).toMatchObject({ km: 600, litres: 40, kmpl: 15, cost: 12000 });
  });

  test("average is distance-weighted, not a mean of means", () => {
    const s = fuelStats([fill("2026-01-01", 0, 10, 100), fill("2026-01-02", 100, 10, 100), fill("2026-01-03", 1100, 50, 500)]);
    expect(s.avgKmpl).toBeCloseTo(1100 / 60, 9); // mean of means would be 15
    expect(s.bestKmpl).toBe(20);
    expect(s.worstKmpl).toBe(10);
    expect(s.lastKmpl).toBe(20);
    expect(s.fuelCostPerKm).toBeCloseTo(600 / 1100, 9);
    expect(s.avgPrice).toBe(10);
  });

  test("no average until two full tanks", () => {
    expect(fuelStats([fill("2026-01-01", 1000, 30, 9000)]).avgKmpl).toBeNull();
    expect(fuelStats([]).lastFill).toBeNull();
  });

  test("monthly spend keeps empty months", () => {
    const m = fuelByMonth([fill("2026-09-05", 1, 1, 500), fill("2026-11-02", 2, 1, 700)], 3, "2026-11-03");
    expect(m.map((x) => [x.key, x.cost])).toEqual([["2026-09", 500], ["2026-10", 0], ["2026-11", 700]]);
  });
});

describe("partial fills with a tank level", () => {
  const partial = (date: string, odo: number, litres: number, tankPct: number | null) => ({ ...fill(date, odo, litres, 1, false), tankPct });

  test("estimates km/l from tank levels, the way the user's previous app does", () => {
    const logs = [fill("2026-09-19", 61599, 27.78, 1), partial("2026-09-24", 61894, 19.639, 91)];
    const e = partialEstimates(logs, 30).get(logs[1].id)!;
    expect(e.km).toBe(295);
    expect(e.litres).toBeCloseTo(22.339, 3); // 30 + 19.639 - 27.3
    expect(e.kmpl).toBeCloseTo(13.21, 2);
  });

  test("chains from one partial level to the next", () => {
    const logs = [fill("2026-01-01", 0, 30, 1), partial("2026-01-05", 200, 10, 50), partial("2026-01-09", 300, 5, 40)];
    const e = partialEstimates(logs, 30);
    expect(e.get(logs[1].id)?.litres).toBeCloseTo(25, 9); // 30 + 10 - 15
    expect(e.get(logs[2].id)?.litres).toBeCloseTo(8, 9); // 15 + 5 - 12
  });

  test("a partial fill with no level carries its litres to the next known level", () => {
    const logs = [fill("2026-01-01", 0, 30, 1), partial("2026-01-05", 100, 5, null), partial("2026-01-09", 300, 5, 50)];
    const e = partialEstimates(logs, 30);
    expect(e.has(logs[1].id)).toBe(false);
    expect(e.get(logs[2].id)).toMatchObject({ km: 300, litres: 25 }); // 30 + 5 + 5 - 15
  });

  test("needs a tank size and a known starting level", () => {
    const first = partial("2026-01-05", 100, 5, 50);
    expect(partialEstimates([fill("2026-01-01", 0, 30, 1), first], null).size).toBe(0);
    expect(partialEstimates([first], 30).size).toBe(0);
  });

  test("the fuel average still comes only from full tanks", () => {
    const logs = [fill("2026-01-01", 0, 30, 1), partial("2026-01-05", 200, 10, 90), fill("2026-01-09", 400, 20, 1)];
    expect(fuelStats(logs).avgKmpl).toBeCloseTo(400 / 30, 9);
    expect(fuelStats(logs).segments).toHaveLength(1);
  });
});

describe("odometer", () => {
  test("combines every source and takes the highest reading", () => {
    const pts = odoPoints(vehicle, [fill("2026-02-01", 2000, 1, 1)], [{ id: "o", vehicleId: "v", date: "2026-03-01", odo: 3000, note: "", createdAt: 0 }], [svc("2026-02-15", 2500, 1), svc("2026-02-20", null, 1)]);
    expect(pts.map((p) => p.odo)).toEqual([1000, 2000, 2500, 3000]);
    expect(currentOdo(pts)).toBe(3000);
  });

  test("driving rate needs a week of history", () => {
    expect(kmPerDay([{ date: "2026-10-01", odo: 1000 }, { date: "2026-10-03", odo: 1100 }], "2026-10-05")).toBeNull();
    expect(kmPerDay([{ date: "2026-10-01", odo: 1000 }, { date: "2026-10-11", odo: 1300 }], "2026-10-12")).toBe(30);
  });

  test("flags readings that would run the odometer backwards", () => {
    const pts = [{ date: "2026-01-01", odo: 1000 }, { date: "2026-03-01", odo: 2000 }];
    expect(odoConflict("2026-02-01", 1500, pts)).toBeNull();
    expect(odoConflict("2026-02-01", 900, pts)).toContain("Lower");
    expect(odoConflict("2026-02-01", 2100, pts)).toContain("Higher");
    expect(odoConflict("2026-04-01", 2500, pts)).toBeNull();
  });
});

describe("maintenance", () => {
  const T = "2026-06-01";
  test("due by whichever of km or date comes first", () => {
    expect(reminderStatus(rem({ dueOdo: 9000, dueDate: "2027-01-01" }), 9500, null, T).status).toBe("overdue");
    expect(reminderStatus(rem({ dueOdo: 90000, dueDate: "2026-05-01" }), 9500, null, T).status).toBe("overdue");
    expect(reminderStatus(rem({ dueDate: "2026-06-20" }), 0, null, T).status).toBe("soon");
    expect(reminderStatus(rem({ dueOdo: 10000, intervalKm: 5000 }), 9800, null, T).status).toBe("soon");
    expect(reminderStatus(rem({ dueOdo: 20000, dueDate: "2027-01-01", intervalKm: 5000 }), 9500, null, T).status).toBe("ok");
    expect(reminderStatus(rem({}), 9500, null, T).status).toBe("unset");
  });

  test("predicts the date from the driving rate", () => {
    const s = reminderStatus(rem({ dueOdo: 11000, intervalKm: 5000 }), 10000, 50, T);
    expect(s).toMatchObject({ kmLeft: 1000, effectiveDays: 20, predictedDate: "2026-06-21", status: "ok" });
    expect(reminderStatus(rem({ dueOdo: 11000, intervalKm: 5000 }), 10000, 100, T).status).toBe("soon"); // 10 days away
  });

  test("interval used follows the more advanced of km and time", () => {
    const s = reminderStatus(rem({ lastOdo: 5000, dueOdo: 10000, lastDate: "2026-01-01", dueDate: "2027-01-01" }), 9000, null, T);
    expect(s.used).toBeCloseTo(0.8, 9);
  });

  test("marking done rolls the next due point forward", () => {
    expect(advanceReminder(rem({ intervalKm: 5000, intervalMonths: 6 }), "2026-06-01", 12000)).toEqual({ lastDate: "2026-06-01", lastOdo: 12000, dueDate: "2026-12-01", dueOdo: 17000 });
    expect(advanceReminder(rem({}), "2026-06-01", 12000)).toEqual({ lastDate: "2026-06-01", lastOdo: 12000, dueDate: null, dueOdo: null });
    expect(advanceReminder(rem({ intervalKm: 5000, lastOdo: 100 }), "2026-06-01", null)).toMatchObject({ lastOdo: 100, dueOdo: null });
  });

  test("month arithmetic clamps to month length", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("fuel CSV import", () => {
  const HEAD = "Date,Odometer (km),Litres,Cost (Rs),Rs per litre,Full tank,Station";

  test("reads the export format, including quotes, commas and Windows line endings", () => {
    const { rows, errors } = parseFuelCsv(`${HEAD}\r\n2026-01-01,"1,000",30,"9,000.50",300,yes,"PSO, Main ""Blvd"""\r\n2026-01-10,1400,25,7500,300,no,\r\n`);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { date: "2026-01-01", odo: 1000, litres: 30, cost: 9000.5, full: true, tankPct: null, station: 'PSO, Main "Blvd"' },
      { date: "2026-01-10", odo: 1400, litres: 25, cost: 7500, full: false, tankPct: null, station: "" },
    ]);
  });

  test("column order doesn't matter, and cost can come from price", () => {
    const { rows } = parseFuelCsv("Litres,Rs per litre,Date,Odometer\n10,250.5,2026-02-01,500");
    expect(rows[0]).toMatchObject({ date: "2026-02-01", odo: 500, litres: 10, cost: 2505, full: true });
  });

  test("reports bad lines with their line number instead of guessing", () => {
    const { rows, errors } = parseFuelCsv(`${HEAD}\n2026-13-45,1000,30,9000,,yes,\n2026-01-02,abc,30,9000,,yes,\n2026-01-03,1000,0,9000,,yes,\n2026-01-04,1000,30,,,yes,\n2026-01-05,1000,30,9000,,maybe,\n\n2026-01-06,1000,30,9000,,no,`);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6]);
    expect(rows.map((r) => r.date)).toEqual(["2026-01-06"]);
    expect(parseFuelCsv("name,value\na,b").errors[0].message).toContain("Expected columns");
  });

  test("reads tank % for partial fills, ignores it on full tanks, rejects nonsense", () => {
    const h = "Date,Odometer,Litres,Cost,Full tank,Tank %";
    const { rows, errors } = parseFuelCsv(`${h}\n2026-01-01,1,1,1,no,81\n2026-01-02,2,1,1,no,75%\n2026-01-03,3,1,1,yes,50\n2026-01-04,4,1,1,no,\n2026-01-05,5,1,1,no,120`);
    expect(rows.map((r) => r.tankPct)).toEqual([81, 75, null, null]);
    expect(errors).toEqual([{ line: 6, message: 'Tank % must be 0-100, got "120".' }]);
  });

  test("skips what's already logged and anything that would run the odometer backwards", () => {
    const row = (date: string, odo: number) => ({ date, odo, litres: 10, cost: 100, full: true, tankPct: null, station: "" });
    const existing = [fill("2026-03-01", 2000, 1, 1)];
    const plan = planFuelImport([row("2026-04-01", 3000), row("2026-03-01", 2000), row("2026-02-01", 2500), row("2026-02-15", 1500), row("2026-03-15", 2900), row("2026-03-20", 2800)], existing, [{ date: "2026-03-01", odo: 2000 }]);
    expect(plan.duplicates.map((r) => r.odo)).toEqual([2000]);
    expect(plan.conflicts.map((c) => c.row.odo)).toEqual([2500, 2800]);
    expect(plan.toAdd.map((r) => r.odo)).toEqual([1500, 2900, 3000]); // oldest first
  });

  test("importing the same file twice adds nothing", () => {
    const row = { date: "2026-04-01", odo: 3000, litres: 10, cost: 100, full: true, tankPct: null, station: "" };
    const first = planFuelImport([row], [], []);
    expect(first.toAdd).toHaveLength(1);
    expect(planFuelImport([row], [fill("2026-04-01", 3000, 10, 100)], [{ date: "2026-04-01", odo: 3000 }]).toAdd).toHaveLength(0);
  });
});

describe("costs and insights", () => {
  test("cost per km covers fuel and service", () => {
    const c = runningCosts([fill("2026-01-01", 1000, 1, 3000)], [svc("2026-02-01", 2000, 2000)], [{ date: "2026-01-01", odo: 1000 }, { date: "2026-02-01", odo: 2000 }], "2026-03-01");
    expect(c).toMatchObject({ fuelCost: 3000, serviceCost: 2000, total: 5000, km: 1000, perKm: 5 });
  });

  test("warns when recent fuel average drops", () => {
    const fuel = [fill("2026-01-01", 0, 10, 1), fill("2026-01-02", 200, 10, 1), fill("2026-01-03", 400, 10, 1), fill("2026-01-04", 600, 10, 1), fill("2026-01-05", 720, 10, 1), fill("2026-01-06", 840, 10, 1), fill("2026-01-07", 960, 10, 1)];
    const i = vehicleInsights({ fuel, service: [], reminders: [], tankLitres: null, odo: 960, perDay: null, today: "2026-01-08" });
    expect(i.find((x) => x.tone === "warn")?.title).toContain("Fuel average down");
  });

  test("nudges towards setup when things are missing", () => {
    const i = vehicleInsights({ fuel: [fill("2026-01-01", 0, 10, 1)], service: [], reminders: [], tankLitres: null, odo: 0, perDay: null, today: "2026-01-08" });
    expect(i.map((x) => x.title)).toEqual(expect.arrayContaining(["Fuel average needs two full tanks", "No service reminders yet", "Track insurance and token tax"]));
  });
});
