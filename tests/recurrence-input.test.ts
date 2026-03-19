import { describe, expect, it } from "vitest";
import { normalizeRecurrenceInput } from "@shared/utils/recurrenceInput";

describe("normalizeRecurrenceInput", () => {
  it("does not convert an empty daysOfWeek field into 0", () => {
    const recurrence = normalizeRecurrenceInput({
      frequency: "none",
      interval: "1",
      daysOfWeek: "",
      dayOfMonth: "",
      monthOfYear: "",
      untilDate: "",
      count: "",
    });

    expect(recurrence).toEqual({
      frequency: "none",
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      monthOfYear: null,
      untilDate: null,
      count: null,
    });
  });

  it("keeps only valid weekday numbers for weekly recurrence", () => {
    const recurrence = normalizeRecurrenceInput({
      frequency: "weekly",
      interval: "2",
      daysOfWeek: "2, ,4,0,8",
      dayOfMonth: "17",
      monthOfYear: "12",
      untilDate: "2026-03-31",
      count: "3",
    });

    expect(recurrence).toEqual({
      frequency: "weekly",
      interval: 2,
      daysOfWeek: [2, 4],
      dayOfMonth: null,
      monthOfYear: null,
      untilDate: "2026-03-31",
      count: 3,
    });
  });
});
