import type { DatabaseService } from "@main/services/DatabaseService";
import { dayjs, endOfDayIso, withDateKeyTime } from "@shared/utils/date";
import { isClosedEventStatus, normalizeEventStatus } from "@shared/utils/eventStatus";
import {
  recurrenceRuleInputSchema,
  type EventRecord,
  type ExpandedCalendarItem,
  type OccurrenceOverrideInput,
  type RecurrenceRuleInput,
} from "@shared/schemas/event";

type ExpandedEventSource = EventRecord & {
  tags: string[];
  noteIds: string[];
  noteCount: number;
  linkCount: number;
};

type OverrideRecord = {
  id: string;
  eventId: string;
  occurrenceDate: string;
  overrideType: "skip" | "status" | "datetime";
  status: string | null;
  startAt: string | null;
  endAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class RecurrenceService {
  constructor(private readonly databaseService: DatabaseService) {}

  getRuleByEventId(eventId: string): RecurrenceRuleInput {
    const row = this.databaseService.db.prepare("SELECT * FROM recurrence_rules WHERE eventId = ?").get(eventId) as
      | {
          frequency: string;
          interval: number;
          daysOfWeekJson: string;
          dayOfMonth: number | null;
          monthOfYear: number | null;
          untilDate: string | null;
          count: number | null;
        }
      | undefined;

    if (!row) {
      return {
        frequency: "none",
        interval: 1,
        daysOfWeek: [],
        dayOfMonth: null,
        monthOfYear: null,
        untilDate: null,
        count: null,
      };
    }

    return recurrenceRuleInputSchema.parse({
      frequency: row.frequency,
      interval: row.interval,
      daysOfWeek: JSON.parse(row.daysOfWeekJson || "[]"),
      dayOfMonth: row.dayOfMonth,
      monthOfYear: row.monthOfYear,
      untilDate: row.untilDate,
      count: row.count,
    });
  }

  saveRule(eventId: string, recurrence: RecurrenceRuleInput): void {
    if (recurrence.frequency === "none") {
      this.databaseService.db.prepare("DELETE FROM recurrence_rules WHERE eventId = ?").run(eventId);
      return;
    }

    const existing = this.databaseService.db
      .prepare("SELECT id, createdAt FROM recurrence_rules WHERE eventId = ?")
      .get(eventId) as { id: string; createdAt: string } | undefined;
    const now = new Date().toISOString();
    const id = existing?.id ?? crypto.randomUUID();
    const createdAt = existing?.createdAt ?? now;

    this.databaseService.db
      .prepare(
        `
        INSERT INTO recurrence_rules (
          id, eventId, frequency, interval, daysOfWeekJson, dayOfMonth, monthOfYear, untilDate, count, excludedDatesJson, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          frequency = excluded.frequency,
          interval = excluded.interval,
          daysOfWeekJson = excluded.daysOfWeekJson,
          dayOfMonth = excluded.dayOfMonth,
          monthOfYear = excluded.monthOfYear,
          untilDate = excluded.untilDate,
          count = excluded.count,
          updatedAt = excluded.updatedAt
        `,
      )
      .run(
        id,
        eventId,
        recurrence.frequency,
        recurrence.interval,
        JSON.stringify(recurrence.daysOfWeek),
        recurrence.dayOfMonth,
        recurrence.monthOfYear,
        recurrence.untilDate,
        recurrence.count,
        createdAt,
        now,
      );
  }

  getOverridesByEventId(eventId: string): OverrideRecord[] {
    return this.databaseService.db
      .prepare("SELECT * FROM occurrence_overrides WHERE eventId = ?")
      .all(eventId) as OverrideRecord[];
  }

  getOverride(eventId: string, occurrenceDate: string): OverrideRecord | null {
    const row = this.databaseService.db
      .prepare("SELECT * FROM occurrence_overrides WHERE eventId = ? AND occurrenceDate = ?")
      .get(eventId, occurrenceDate) as OverrideRecord | undefined;
    return row ?? null;
  }

  upsertOccurrenceOverride(eventId: string, occurrenceDate: string, override: OccurrenceOverrideInput): void {
    const existing = this.databaseService.db
      .prepare("SELECT id, createdAt FROM occurrence_overrides WHERE eventId = ? AND occurrenceDate = ?")
      .get(eventId, occurrenceDate) as { id: string; createdAt: string } | undefined;
    const id = existing?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = existing?.createdAt ?? now;

    this.databaseService.db
      .prepare(
        `
        INSERT INTO occurrence_overrides (
          id, eventId, occurrenceDate, overrideType, status, startAt, endAt, completedAt, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          overrideType = excluded.overrideType,
          status = excluded.status,
          startAt = excluded.startAt,
          endAt = excluded.endAt,
          completedAt = excluded.completedAt,
          updatedAt = excluded.updatedAt
        `,
      )
      .run(
        id,
        eventId,
        occurrenceDate,
        override.overrideType,
        override.status ?? null,
        override.startAt ?? null,
        override.endAt ?? null,
        override.completedAt ?? null,
        createdAt,
        now,
      );
  }

  expandEvent(event: ExpandedEventSource, recurrence: RecurrenceRuleInput, rangeStartIso: string, rangeEndIso: string): ExpandedCalendarItem[] {
    if (recurrence.frequency === "none") {
      return [];
    }

    const startDate = dayjs.utc(event.startAt ?? event.createdAt).startOf("day");
    const rangeStart = dayjs.utc(rangeStartIso).startOf("day");
    const rangeEnd = dayjs.utc(rangeEndIso).endOf("day");
    const until = recurrence.untilDate ? dayjs.utc(recurrence.untilDate).endOf("day") : null;
    const overrides = new Map(this.getOverridesByEventId(event.id).map((item) => [item.occurrenceDate, item]));
    const candidates: string[] = [];

    if (recurrence.frequency === "daily") {
      let current = startDate;
      let count = 0;
      while (current.isBefore(rangeEnd) || current.isSame(rangeEnd, "day")) {
        if (until && current.isAfter(until)) {
          break;
        }

        count += 1;
        if ((!recurrence.count || count <= recurrence.count) && (current.isAfter(rangeStart) || current.isSame(rangeStart, "day"))) {
          candidates.push(current.format("YYYY-MM-DD"));
        }

        if (recurrence.count && count >= recurrence.count) {
          break;
        }

        current = current.add(recurrence.interval, "day");
      }
    }

    if (recurrence.frequency === "weekly") {
      const daysOfWeek = recurrence.daysOfWeek.length > 0 ? recurrence.daysOfWeek : [startDate.isoWeekday()];
      let current = startDate;
      let count = 0;
      let guard = 0;

      while ((current.isBefore(rangeEnd) || current.isSame(rangeEnd, "day")) && guard < 4000) {
        guard += 1;
        const weeksDiff = current.startOf("week").diff(startDate.startOf("week"), "week");
        const matchesCycle = weeksDiff >= 0 && weeksDiff % recurrence.interval === 0;
        const matchesDay = daysOfWeek.includes(current.isoWeekday());

        if (matchesCycle && matchesDay) {
          if (until && current.isAfter(until)) {
            break;
          }

          count += 1;
          if ((!recurrence.count || count <= recurrence.count) && (current.isAfter(rangeStart) || current.isSame(rangeStart, "day"))) {
            candidates.push(current.format("YYYY-MM-DD"));
          }

          if (recurrence.count && count >= recurrence.count) {
            break;
          }
        }

        current = current.add(1, "day");
      }
    }

    if (recurrence.frequency === "monthly") {
      const targetDay = recurrence.dayOfMonth ?? startDate.date();
      let currentMonth = startDate.startOf("month");
      let count = 0;
      let guard = 0;

      while ((currentMonth.isBefore(rangeEnd) || currentMonth.isSame(rangeEnd, "month")) && guard < 240) {
        guard += 1;
        const candidate = currentMonth.date(targetDay);
        const valid = candidate.month() === currentMonth.month() && (candidate.isAfter(startDate) || candidate.isSame(startDate, "day"));

        if (valid) {
          if (until && candidate.isAfter(until)) {
            break;
          }

          count += 1;
          if ((!recurrence.count || count <= recurrence.count) && (candidate.isAfter(rangeStart) || candidate.isSame(rangeStart, "day")) && candidate.isBefore(rangeEnd.add(1, "day"))) {
            candidates.push(candidate.format("YYYY-MM-DD"));
          }

          if (recurrence.count && count >= recurrence.count) {
            break;
          }
        }

        currentMonth = currentMonth.add(recurrence.interval, "month");
      }
    }

    if (recurrence.frequency === "yearly") {
      const targetMonth = recurrence.monthOfYear ?? startDate.month() + 1;
      const targetDay = recurrence.dayOfMonth ?? startDate.date();
      let currentYear = startDate.startOf("year");
      let count = 0;
      let guard = 0;

      while ((currentYear.isBefore(rangeEnd) || currentYear.isSame(rangeEnd, "year")) && guard < 120) {
        guard += 1;
        const candidate = currentYear.month(targetMonth - 1).date(targetDay);
        const valid = candidate.month() === targetMonth - 1 && (candidate.isAfter(startDate) || candidate.isSame(startDate, "day"));

        if (valid) {
          if (until && candidate.isAfter(until)) {
            break;
          }

          count += 1;
          if ((!recurrence.count || count <= recurrence.count) && (candidate.isAfter(rangeStart) || candidate.isSame(rangeStart, "day")) && candidate.isBefore(rangeEnd.add(1, "day"))) {
            candidates.push(candidate.format("YYYY-MM-DD"));
          }

          if (recurrence.count && count >= recurrence.count) {
            break;
          }
        }

        currentYear = currentYear.add(recurrence.interval, "year");
      }
    }

    return candidates
      .filter((dateKey) => {
        const override = overrides.get(dateKey);
        return override?.overrideType !== "skip";
      })
      .map((dateKey) => this.createOccurrence(event, dateKey, overrides.get(dateKey) ?? null));
  }

  private createOccurrence(event: ExpandedEventSource, occurrenceDate: string, override: OverrideRecord | null): ExpandedCalendarItem {
    const defaultStart = withDateKeyTime(occurrenceDate, event.startAt, event.timezone);
    const defaultEnd = event.endAt
      ? withDateKeyTime(occurrenceDate, event.endAt, event.timezone)
      : event.allDay
        ? endOfDayIso(occurrenceDate, event.timezone)
        : null;

    const startAt = override?.overrideType === "datetime" ? override.startAt ?? defaultStart : defaultStart;
    const endAt = override?.overrideType === "datetime" ? override.endAt ?? defaultEnd : defaultEnd;
    const status = normalizeEventStatus(override?.overrideType === "status" && override.status ? override.status : event.status);
    const completedAt = override?.overrideType === "status" ? override.completedAt : event.completedAt;

    return {
      ...event,
      id: `${event.id}::${occurrenceDate}`,
      baseEventId: event.id,
      occurrenceDate,
      virtualInstanceId: `${event.id}::${occurrenceDate}`,
      isVirtual: true,
      startAt,
      endAt,
      status,
      completedAt,
      overdue: this.isOverdue(status, endAt, occurrenceDate),
    };
  }

  private isOverdue(status: string, endAt: string | null, occurrenceDate: string): boolean {
    if (isClosedEventStatus(status)) {
      return false;
    }

    const compareTarget = endAt ?? endOfDayIso(occurrenceDate);
    return dayjs(compareTarget).isBefore(dayjs());
  }
}
