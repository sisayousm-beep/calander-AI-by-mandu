import { describe, expect, it } from "vitest";
import { RecurrenceService } from "@main/services/RecurrenceService";

describe("RecurrenceService", () => {
  it("expands weekly rules within a range", () => {
    const service = new RecurrenceService({
      db: {
        prepare: () => ({
          all: () => [],
          get: () => undefined,
        }),
      },
    } as never);

    const items = service.expandEvent(
      {
        id: "event-1",
        title: "주간 회의",
        description: "",
        startAt: "2026-03-02T10:00:00.000Z",
        endAt: "2026-03-02T11:00:00.000Z",
        allDay: false,
        status: "예정",
        completedAt: null,
        color: "#2563eb",
        source: "manual",
        timezone: "Asia/Seoul",
        isRecurring: true,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        tags: [],
        noteIds: [],
        noteCount: 0,
        linkCount: 0,
      },
      {
        frequency: "weekly",
        interval: 1,
        daysOfWeek: [1, 3],
        dayOfMonth: null,
        monthOfYear: null,
        untilDate: null,
        count: null,
      },
      "2026-03-01T00:00:00.000Z",
      "2026-03-15T23:59:59.999Z",
    );

    expect(items.map((item) => item.occurrenceDate)).toEqual([
      "2026-03-02",
      "2026-03-04",
      "2026-03-09",
      "2026-03-11",
    ]);
  });
});
