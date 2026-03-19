import { describe, expect, it } from "vitest";
import { FormulaService } from "@main/services/FormulaService";

describe("FormulaService", () => {
  it("evaluates boolean expressions with English helper functions", () => {
    const service = new FormulaService({} as never);
    const result = service.evaluate("and(hasMemo(), not(isDone()))", "event", {
      status: "예정",
      noteCount: 1,
      linkCount: 0,
      tags: ["중요"],
    });

    expect(result.ok).toBe(true);
    expect(result.result).toBe(true);
  });

  it("returns recurrence totals and current occurrence counts", () => {
    const service = new FormulaService({} as never);
    const result = service.evaluate("and(eq(totalRecurrenceCount(), 12), eq(currentRecurrenceCount(), 3))", "event", {
      status: "예정",
      isRecurring: true,
      startAt: "2026-03-03T09:00:00.000Z",
      occurrenceDate: "2026-03-17",
      recurrence: {
        frequency: "weekly",
        interval: 1,
        daysOfWeek: [2],
        dayOfMonth: null,
        monthOfYear: null,
        untilDate: null,
        count: 12,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.result).toBe(true);
  });

  it("returns an error for invalid expressions", () => {
    const service = new FormulaService({} as never);
    const result = service.evaluate("and(", "event", {});

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
