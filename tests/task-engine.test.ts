import { describe, expect, test } from "vitest";
import {
  bucketOf,
  calculateBucketDrop,
  calculateTaskReorder,
  cleanRecurrence,
  computeNextDueDate,
  dueLabel,
  focusTasks,
  grouped,
  parseQuickAdd,
  recurrenceLabel,
  sortTasks,
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

describe("task reordering & drag-to-adjust attributes", () => {
  test("dragging a later task before overdue task puts it at the top with high priority", () => {
    const overdue = task({ id: "o1", due: "2026-10-10", priority: "med", createdAt: 1000 });
    const later = task({ id: "l1", due: "2026-10-30", priority: "low", createdAt: 2000 });
    const patch = calculateTaskReorder([overdue, later], "l1", "o1", "before", T);
    expect(patch).toMatchObject({
      due: "2026-10-10",
      priority: "high",
    });
    expect(patch!.createdAt).toBeLessThan(overdue.createdAt);
    // Verify it now sorts first
    const updated = { ...later, ...patch };
    expect([overdue, updated].sort(sortTasks)[0].id).toBe("l1");
  });

  test("dragging a later task before a due today task puts it on top of today's tasks with high priority", () => {
    const dueToday = task({ id: "d1", due: T, priority: "med", createdAt: 1500 });
    const later = task({ id: "l1", due: "2026-10-25", priority: "low", createdAt: 3000 });
    const patch = calculateTaskReorder([dueToday, later], "l1", "d1", "before", T);
    expect(patch).toMatchObject({
      due: T,
      priority: "high",
    });
    expect(patch!.createdAt).toBeLessThan(dueToday.createdAt);
    const updated = { ...later, ...patch };
    expect([dueToday, updated].sort(sortTasks)[0].id).toBe("l1");
  });

  test("dragging a later task on top of due tasks when overdue tasks exist", () => {
    const overdue = task({ id: "o1", due: "2026-10-12", priority: "med", createdAt: 1000 });
    const dueToday = task({ id: "d1", due: T, priority: "med", createdAt: 1500 });
    const later = task({ id: "l1", due: "2026-10-28", priority: "low", createdAt: 2000 });
    const patch = calculateTaskReorder([overdue, dueToday, later], "l1", "d1", "before", T);
    expect(patch).toMatchObject({
      due: T,
      priority: "high",
    });
    const updated = { ...later, ...patch };
    const sorted = [overdue, dueToday, updated].sort(sortTasks);
    expect(sorted.map((t) => t.id)).toEqual(["o1", "l1", "d1"]);
  });

  test("dragging within same bucket: low priority above high priority becomes high priority", () => {
    const high = task({ id: "h1", due: T, priority: "high", createdAt: 1000 });
    const low = task({ id: "w1", due: T, priority: "low", createdAt: 2000 });
    const patch = calculateTaskReorder([high, low], "w1", "h1", "before", T);
    expect(patch).toMatchObject({
      due: T,
      priority: "high",
    });
    expect(patch!.createdAt).toBeLessThan(high.createdAt);
    const updated = { ...low, ...patch };
    expect([high, updated].sort(sortTasks)[0].id).toBe("w1");
  });

  test("dragging within same bucket: high priority dragged after low priority becomes low priority", () => {
    const high = task({ id: "h1", due: T, priority: "high", createdAt: 1000 });
    const low = task({ id: "w1", due: T, priority: "low", createdAt: 2000 });
    const patch = calculateTaskReorder([high, low], "h1", "w1", "after", T);
    expect(patch).toMatchObject({
      due: T,
      priority: "low",
    });
    expect(patch!.createdAt).toBeGreaterThan(low.createdAt);
    const updated = { ...high, ...patch };
    expect([updated, low].sort(sortTasks)[1].id).toBe("h1");
  });

  test("dragging between two tasks with same priority places createdAt in-between", () => {
    const t1 = task({ id: "t1", due: T, priority: "med", createdAt: 1000 });
    const t2 = task({ id: "t2", due: T, priority: "med", createdAt: 3000 });
    const t3 = task({ id: "t3", due: "2026-10-29", priority: "low", createdAt: 5000 });
    const patch = calculateTaskReorder([t1, t2, t3], "t3", "t2", "before", T);
    expect(patch).toMatchObject({
      due: T,
      priority: "med",
      createdAt: 2000,
    });
    const updated = { ...t3, ...patch };
    const sorted = [t1, t2, updated].sort(sortTasks);
    expect(sorted.map((t) => t.id)).toEqual(["t1", "t3", "t2"]);
  });

  test("dragging open task onto completed task marks it completed", () => {
    const open = task({ id: "o1", due: T, done: false });
    const done = task({ id: "d1", due: T, done: true, completedAt: 1000 });
    const patch = calculateTaskReorder([open, done], "o1", "d1", "before", T);
    expect(patch?.done).toBe(true);
    expect(typeof patch?.completedAt).toBe("number");
  });

  test("calculateBucketDrop sets appropriate dates and priorities", () => {
    const t1 = task({ id: "t1", due: "2026-10-30", priority: "low" });
    expect(calculateBucketDrop(t1, "today", T)).toMatchObject({
      due: T,
      priority: "high",
    });
    expect(calculateBucketDrop(t1, "tomorrow", T)).toMatchObject({
      due: "2026-10-18",
    });
    expect(calculateBucketDrop(t1, "someday", T)).toMatchObject({
      due: null,
    });
    expect(calculateBucketDrop(t1, "done", T)).toMatchObject({
      done: true,
    });
  });
});
