import { describe, expect, it } from "vitest";
import { aiParsedResultSchema } from "@shared/schemas/ai";

describe("aiParsedResultSchema", () => {
  it("accepts valid structured AI output", () => {
    const result = aiParsedResultSchema.parse({
      summary: "요약",
      candidates: [
        {
          title: "치과 예약",
          description: "",
          startDate: "2026-03-19",
          startTime: "15:00",
          endDate: null,
          endTime: null,
          allDay: false,
          recurrence: {
            frequency: "none",
            interval: 1,
            daysOfWeek: [],
            dayOfMonth: null,
            monthOfYear: null,
            untilDate: null,
            count: null,
          },
          tags: ["건강"],
          noteDrafts: [],
          confidence: 0.91,
          ambiguityFlags: [],
          questions: [],
        },
      ],
      unresolved: [],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toBe("치과 예약");
  });

  it("rejects invalid date format", () => {
    expect(() =>
      aiParsedResultSchema.parse({
        summary: "요약",
        candidates: [
          {
            title: "잘못된 일정",
            description: "",
            startDate: "2026/03/19",
            startTime: "15:00",
            endDate: null,
            endTime: null,
            allDay: false,
            recurrence: {
              frequency: "none",
              interval: 1,
              daysOfWeek: [],
              dayOfMonth: null,
              monthOfYear: null,
              untilDate: null,
              count: null,
            },
            tags: [],
            noteDrafts: [],
            confidence: 0.5,
            ambiguityFlags: [],
            questions: [],
          },
        ],
        unresolved: [],
      }),
    ).toThrow();
  });
});
