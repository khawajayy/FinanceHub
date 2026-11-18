import { describe, expect, test } from "vitest";
import {
  bucketOf,
  cleanRecurrence,
  computeNextDueDate,
  dueLabel,
  focusTasks,
  grouped,
  parseQuickAdd,
  recurrenceLabel,
  taskStats,
  type Task,
} from "../src/engine/task-engine";

// Saturday 17 Oct 2026
const TODAY = new Date(2026, 9, 17, 10);
const T = "2026-10-17";
const task = (p: Partial<Task>): Task => ({ id: Math.random().toString(36).slice(2), title: "t", notes: "", done: false, priority: "med", due: null, list: null, subtasks: [], createdAt: 0, completedAt: null, ...p });

describe("quick add parsing", () => {
  test("plain text keeps defaults", () => {
    expect(parseQuickAdd("Call the plumber", TODAY)).toEqual({ title: "Call the plumber", due: null, priority: "med", list: null, recurrence: null });
  });
  test("today / tomorrow / priority / list", () => {
    expect(parseQuickAdd("Pay rent tomorrow !high #finance", TODAY)).toMatchObject({ title: "Pay rent", due: "2026-10-18", priority: "high", list: "finance" });
    expect(parseQuickAdd("Gym today !!", TODAY)).toMatchObject({ title: "Gym", due: T, priority: "med" });
    expect(parseQuickAdd("Water plants !low", TODAY).priority).toBe("low");
    expect(parseQuickAdd("Ship it !!!", TODAY).priority).toBe("high");
  });
  test("weekdays go to the next occurrence and drop 'on'", () => {
    expect(parseQuickAdd("Dentist on fri", TODAY)).toMatchObject({ title: "Dentist", due: "2026-10-23" });
    expect(parseQuickAdd("Review sat", TODAY).due).toBe("2026-10-24"); // same weekday -> next week
    expect(parseQuickAdd("Plan next week", TODAY)).toMatchObject({ title: "Plan", due: "2026-10-19" });
  });
  test("explicit dates and relative days", () => {
    expect(parseQuickAdd("Renew passport 25 oct", TODAY).due).toBe("2026-10-25");
    expect(parseQuickAdd("Car service nov 3rd", TODAY).due).toBe("2026-11-03");
    expect(parseQuickAdd("Tax filing 1/9", TODAY).due).toBe("2027-09-01"); // already passed this year
    expect(parseQuickAdd("Follow up in 3 days", TODAY)).toMatchObject({ title: "Follow up", due: "2026-10-20" });
    expect(parseQuickAdd("Book flights by 30 oct", TODAY).title).toBe("Book flights");
  });
  test("words that merely look like dates stay in the title", () => {
    expect(parseQuickAdd("Buy a sunflower", TODAY).title).toBe("Buy a sunflower");
    expect(parseQuickAdd("May the force", TODAY).due).toBeNull();
  });
  test("recurrence parsing: daily, weekly, custom intervals and weekdays", () => {
    expect(parseQuickAdd("Water plants daily", TODAY)).toMatchObject({
      title: "Water plants",
      recurrence: { freq: "daily" },
    });
    expect(parseQuickAdd("Take vitamins every day !high", TODAY)).toMatchObject({
      title: "Take vitamins",
      priority: "high",
      recurrence: { freq: "daily" },
    });
    expect(parseQuickAdd("Team sync weekly #work", TODAY)).toMatchObject({
      title: "Team sync",
      list: "work",
      recurrence: { freq: "weekly" },
    });
    expect(parseQuickAdd("Clean room every 2 weeks", TODAY)).toMatchObject({
      title: "Clean room",
      recurrence: { freq: "custom", interval: 2, unit: "weeks" },
    });
    expect(parseQuickAdd("Water lawn every 3 days", TODAY)).toMatchObject({
      title: "Water lawn",
      recurrence: { freq: "custom", interval: 3, unit: "days" },
    });
    expect(parseQuickAdd("Pay rent every month", TODAY)).toMatchObject({
      title: "Pay rent",
      recurrence: { freq: "custom", interval: 1, unit: "months" },
    });
    expect(parseQuickAdd("Workout on weekdays", TODAY)).toMatchObject({
      title: "Workout",
      recurrence: { freq: "weekly", daysOfWeek: [1, 2, 3, 4, 5] },
    });
    expect(parseQuickAdd("Review goals every sunday", TODAY)).toMatchObject({
      title: "Review goals",
      recurrence: { freq: "weekly", daysOfWeek: [0] },
      due: "2026-10-18", // next sunday
    });
    expect(parseQuickAdd("Explicit tag repeat:daily", TODAY)).toMatchObject({
      title: "Explicit tag",
      recurrence: { freq: "daily" },
    });
  });
});

describe("recurrence calculations & labels", () => {
  test("cleanRecurrence validation", () => {
    expect(cleanRecurrence(null)).toBeNull();
    expect(cleanRecurrence({ freq: "invalid" })).toBeNull();
    expect(cleanRecurrence({ freq: "daily" })).toEqual({ freq: "daily" });
    expect(cleanRecurrence({ freq: "weekly" })).toEqual({ freq: "weekly" });
    expect(cleanRecurrence({ freq: "custom", interval: 3, unit: "days" })).toEqual({ freq: "custom", interval: 3, unit: "days" });
    expect(cleanRecurrence({ freq: "weekly", daysOfWeek: [1, 3, 5] })).toEqual({ freq: "weekly", daysOfWeek: [1, 3, 5] });
  });

  test("recurrenceLabel formatting", () => {
    expect(recurrenceLabel({ freq: "daily" })).toBe("Daily");
    expect(recurrenceLabel({ freq: "weekly" })).toBe("Weekly");
    expect(recurrenceLabel({ freq: "weekly", daysOfWeek: [1, 2, 3, 4, 5] })).toBe("Every weekday");
    expect(recurrenceLabel({ freq: "weekly", daysOfWeek: [1, 3, 5] })).toBe("Weekly on Mon, Wed, Fri");
    expect(recurrenceLabel({ freq: "custom", interval: 1, unit: "days" })).toBe("Daily");
    expect(recurrenceLabel({ freq: "custom", interval: 1, unit: "weeks" })).toBe("Weekly");
    expect(recurrenceLabel({ freq: "custom", interval: 1, unit: "months" })).toBe("Monthly");
    expect(recurrenceLabel({ freq: "custom", interval: 3, unit: "days" })).toBe("Every 3 days");
    expect(recurrenceLabel({ freq: "custom", interval: 2, unit: "weeks" })).toBe("Every 2 weeks");
    expect(recurrenceLabel({ freq: "custom", interval: 6, unit: "months" })).toBe("Every 6 months");
  });

  test("computeNextDueDate for daily tasks", () => {
    // Due today -> next is tomorrow
    expect(computeNextDueDate("2026-10-17", { freq: "daily" }, "2026-10-17")).toBe("2026-10-18");
    // Overdue completed today -> next is tomorrow
    expect(computeNextDueDate("2026-10-10", { freq: "daily" }, "2026-10-17")).toBe("2026-10-18");
    // Due in future (2026-10-20) completed early today -> next is 2026-10-21
    expect(computeNextDueDate("2026-10-20", { freq: "daily" }, "2026-10-17")).toBe("2026-10-21");
    // No due date -> next is tomorrow
    expect(computeNextDueDate(null, { freq: "daily" }, "2026-10-17")).toBe("2026-10-18");
  });

  test("computeNextDueDate for weekly tasks", () => {
    // Due today -> next is 7 days later
    expect(computeNextDueDate("2026-10-17", { freq: "weekly" }, "2026-10-17")).toBe("2026-10-24");
    // Due was last Sunday (2026-10-11), completed Saturday 2026-10-17 -> next Sunday is 2026-10-18
    expect(computeNextDueDate("2026-10-11", { freq: "weekly" }, "2026-10-17")).toBe("2026-10-18");
    // Weekly on weekdays [1, 3, 5] (Mon, Wed, Fri) - Saturday 2026-10-17 -> next is Monday 2026-10-19
    expect(computeNextDueDate("2026-10-16", { freq: "weekly", daysOfWeek: [1, 3, 5] }, "2026-10-17")).toBe("2026-10-19");
  });

  test("computeNextDueDate for custom intervals", () => {
    // Every 3 days
    expect(computeNextDueDate("2026-10-17", { freq: "custom", interval: 3, unit: "days" }, "2026-10-17")).toBe("2026-10-20");
    // Every 2 weeks
    expect(computeNextDueDate("2026-10-17", { freq: "custom", interval: 2, unit: "weeks" }, "2026-10-17")).toBe("2026-10-31");
    // Every 1 month
    expect(computeNextDueDate("2026-10-17", { freq: "custom", interval: 1, unit: "months" }, "2026-10-17")).toBe("2026-11-17");
  });
});

describe("buckets, focus and stats", () => {
  test("bucketing", () => {
    expect(bucketOf(task({ due: "2026-10-16" }), T)).toBe("overdue");
    expect(bucketOf(task({ due: T }), T)).toBe("today");
    expect(bucketOf(task({ due: "2026-10-18" }), T)).toBe("tomorrow");
    expect(bucketOf(task({ due: "2026-10-24" }), T)).toBe("week");
    expect(bucketOf(task({ due: "2026-11-30" }), T)).toBe("later");
    expect(bucketOf(task({}), T)).toBe("someday");
    expect(bucketOf(task({ done: true, due: "2026-10-01" }), T)).toBe("done");
  });
  test("grouping orders buckets and sorts by priority within a day", () => {
    const g = grouped([task({ id: "a", due: T, priority: "low" }), task({ id: "b", due: T, priority: "high" }), task({ id: "c", due: "2026-10-10" })], T);
    expect(g.map((x) => x.bucket)).toEqual(["overdue", "today"]);
    expect(g[1].tasks.map((t) => t.id)).toEqual(["b", "a"]);
  });
  test("focus picks overdue and today first", () => {
    const f = focusTasks([task({ id: "x", due: "2026-12-01" }), task({ id: "h", priority: "high" }), task({ id: "o", due: "2026-10-01" }), task({ id: "t", due: T })], T);
    expect(f.map((t) => t.id)).toEqual(["o", "t", "h"]);
  });
  test("stats: today progress, streak and recurring count", () => {
    const at = (d: number) => new Date(2026, 9, d, 9).getTime();
    const s = taskStats([
      task({ done: true, completedAt: at(17) }), task({ done: true, completedAt: at(16) }), task({ done: true, completedAt: at(15) }),
      task({ done: true, completedAt: at(13) }), task({ due: T }), task({ due: "2026-10-12" }),
      task({ recurrence: { freq: "daily" } }),
    ], TODAY);
    expect(s.doneToday).toBe(1);
    expect(s.streak).toBe(3);
    expect(s.todayProgress).toBeCloseTo(1 / 3, 9);
    expect(s.last7.map((d) => d.count)).toEqual([0, 0, 1, 0, 1, 1, 1]);
    expect(s.recurring).toBe(1);
  });
  test("due labels", () => {
    expect(dueLabel(T, T)).toBe("Today");
    expect(dueLabel("2026-10-14", T)).toBe("3d overdue");
  });
});
