import { describe, expect, test } from "vitest";
import { areaSummary, evaluate, goalStats, nextMilestone, pace, progress, type Goal, type GoalCtx } from "../src/engine/goal-engine";
import type { Task } from "../src/engine/task-engine";

const goal = (p: Partial<Goal>): Goal => ({
  id: "g", title: "Goal", why: "", area: "personal", status: "active", startDate: "2026-01-01", targetDate: "2026-12-31",
  metric: "checklist", unit: "", start: 0, target: 0, current: 0, log: [], milestones: [], createdAt: 0, completedAt: null, ...p,
});
const task = (p: Partial<Task>): Task => ({ id: Math.random().toString(36).slice(2), title: "t", notes: "", done: false, priority: "med", due: null, list: null, subtasks: [], createdAt: 0, completedAt: null, ...p });
const ctx = (p: Partial<GoalCtx> = {}): GoalCtx => ({ tasks: [], netWorthPkr: null, equityUsd: null, today: "2026-07-02", ...p });

describe("goal progress", () => {
  test("checklist counts milestones and linked tasks", () => {
    const g = goal({ milestones: [{ id: "m1", title: "a", done: true, due: null }, { id: "m2", title: "b", done: false, due: null }] });
    const tasks = [task({ goalId: "g", done: true }), task({ goalId: "g" }), task({ goalId: "other", done: true })];
    const p = progress(g, ctx({ tasks }));
    expect(p).toMatchObject({ done: 2, total: 4, pct: 0.5 });
  });

  test("number goals work upwards and downwards", () => {
    expect(progress(goal({ metric: "number", start: 0, target: 500, current: 125 }), ctx()).pct).toBe(0.25);
    expect(progress(goal({ metric: "number", start: 90, target: 75, current: 84 }), ctx()).pct).toBeCloseTo(0.4, 9); // weight loss
    expect(progress(goal({ metric: "number", start: 0, target: 10, current: 14 }), ctx()).pct).toBe(1); // clamped
  });

  test("finance goals read live figures", () => {
    const g = goal({ metric: "networth", start: 5_000_000, target: 10_000_000 });
    expect(progress(g, ctx({ netWorthPkr: 6_000_000 })).pct).toBeCloseTo(0.2, 9);
    expect(progress(g, ctx()).pct).toBe(0); // rate not loaded yet
    expect(progress(goal({ metric: "portfolio", start: 5000, target: 10000 }), ctx({ equityUsd: 7500 })).pct).toBe(0.5);
  });

  test("done goals are 100%", () => {
    expect(progress(goal({ status: "done" }), ctx()).pct).toBe(1);
  });
});

describe("pace", () => {
  // 2026-07-02 is exactly halfway through 2026 (182 of 364 days)
  test("compares with straight-line expectation", () => {
    const g = goal({});
    expect(pace(g, 0.5, "2026-07-02").pace).toBe("on-track");
    expect(pace(g, 0.65, "2026-07-02").pace).toBe("ahead");
    expect(pace(g, 0.3, "2026-07-02").pace).toBe("at-risk");
    expect(pace(g, 0.9, "2027-01-05")).toMatchObject({ pace: "overdue", daysLeft: -5 });
    expect(pace(goal({ targetDate: null }), 0.1, "2026-07-02").pace).toBe("no-date");
    expect(pace(goal({ status: "paused" }), 0.1, "2026-07-02").pace).toBe("paused");
  });

  test("required weekly rate for value goals", () => {
    const e = evaluate(goal({ metric: "number", start: 0, target: 520, current: 260, targetDate: "2026-12-31" }), ctx({ today: "2026-07-02" }));
    expect(e.rate).toBeCloseTo(260 / 26, 9);
  });
});

describe("summaries", () => {
  test("area averages, stats and next milestone", () => {
    const goals = [
      goal({ id: "a", area: "health", metric: "number", start: 0, target: 10, current: 5 }),
      goal({ id: "b", area: "health", status: "done", completedAt: new Date(2026, 3, 1).getTime() }),
      goal({ id: "c", area: "career", metric: "number", start: 0, target: 10, current: 1 }),
      goal({ id: "d", area: "career", status: "dropped" }),
    ];
    const s = areaSummary(goals, ctx());
    expect(s.find((x) => x.key === "health")).toMatchObject({ count: 2, avg: 0.75 });
    expect(s.find((x) => x.key === "career")?.count).toBe(1);
    expect(goalStats(goals, ctx())).toEqual({ active: 2, onTrack: 1, atRisk: 1, doneThisYear: 1 });
    const m = nextMilestone(goal({ milestones: [{ id: "1", title: "x", done: false, due: null }, { id: "2", title: "y", done: false, due: "2026-08-01" }, { id: "3", title: "z", done: true, due: "2026-02-01" }] }));
    expect(m?.id).toBe("2");
  });
});
