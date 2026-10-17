import { describe, expect, test } from "vitest";
import { LESSONS, lessonForDate, lessonForDay, localDayNumber, msUntilNextLesson } from "../src/engine/lessons";

describe("daily lessons", () => {
  test("library entries are complete and ids unique", () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      for (const k of ["id", "theme", "emoji", "quote", "author", "lesson", "practice"] as const) expect(l[k].trim().length).toBeGreaterThan(0);
      expect(l.hues).toHaveLength(2);
    }
  });

  test("same day gives the same lesson; the next day changes", () => {
    const d = localDayNumber(new Date(2026, 9, 18, 9));
    expect(lessonForDay(d).id).toBe(lessonForDay(d).id);
    expect(lessonForDate(new Date(2026, 9, 18, 23, 59)).id).toBe(lessonForDate(new Date(2026, 9, 18, 0, 1)).id);
    expect(lessonForDay(d + 1).id).not.toBe(lessonForDay(d).id);
  });

  test("no repeats within a full cycle", () => {
    const n = LESSONS.length, start = n * 1000; // aligned to a cycle boundary
    const ids = Array.from({ length: n }, (_, i) => lessonForDay(start + i).id);
    expect(new Set(ids).size).toBe(n);
  });

  test("countdown to midnight", () => {
    expect(msUntilNextLesson(new Date(2026, 9, 18, 23, 0))).toBe(3600000);
  });
});
