import type { DatabaseService } from "@main/services/DatabaseService";
import type { LinkService } from "@main/services/LinkService";
import type { RecurrenceService } from "@main/services/RecurrenceService";
import { dayjs, compareNullableIso, endOfDayIso, toDateKey } from "@shared/utils/date";
import { isClosedEventStatus, isDoneEventStatus, normalizeEventStatus } from "@shared/utils/eventStatus";
import {
  eventInputSchema,
  occurrenceOverrideInputSchema,
  type EventDetail,
  type EventInput,
  type EventRecord,
  type ExpandedCalendarItem,
} from "@shared/schemas/event";

type EventRow = EventRecord;

export class EventService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly recurrenceService: RecurrenceService,
    private readonly linkService: LinkService,
  ) {}

  listByRange(rangeStartIso: string, rangeEndIso: string, filters: Record<string, unknown> = {}): ExpandedCalendarItem[] {
    const rows = this.databaseService.db.prepare("SELECT * FROM events").all() as EventRow[];
    const items: ExpandedCalendarItem[] = [];

    for (const row of rows) {
      const augmented = this.hydrateEvent(row.id, row);
      if (augmented.isRecurring) {
        const recurrence = this.recurrenceService.getRuleByEventId(row.id);
        items.push(...this.recurrenceService.expandEvent(augmented, recurrence, rangeStartIso, rangeEndIso));
        continue;
      }

      const item = this.createExpandedBaseItem(augmented);
      if (this.isInRange(item, rangeStartIso, rangeEndIso)) {
        items.push(item);
      }
    }

    return this.applyFilters(items, filters).sort((left, right) => {
      const startDiff = compareNullableIso(left.startAt, right.startAt);
      if (startDiff !== 0) {
        return startDiff;
      }

      return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
    });
  }

  getById(id: string): EventDetail | null {
    const { baseId, occurrenceDate } = this.splitVirtualId(id);
    const row = this.databaseService.db.prepare("SELECT * FROM events WHERE id = ?").get(baseId) as EventRow | undefined;
    if (!row) {
      return null;
    }

    const augmented = this.hydrateEvent(baseId, row);
    const recurrence = this.recurrenceService.getRuleByEventId(baseId);
    let item: ExpandedCalendarItem;

    if (occurrenceDate) {
      const occurrence = this.recurrenceService
        .expandEvent(augmented, recurrence, `${occurrenceDate}T00:00:00.000Z`, `${occurrenceDate}T23:59:59.999Z`)
        .find((candidate) => candidate.occurrenceDate === occurrenceDate);
      item = occurrence ?? this.createExpandedBaseItem(augmented);
    } else {
      item = this.createExpandedBaseItem(augmented);
    }

    const links = this.linkService.listForEntity("event", baseId);
    return {
      ...item,
      recurrence,
      links,
    };
  }

  create(payload: EventInput): string {
    const parsed = eventInputSchema.parse(payload);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const completedAt = isDoneEventStatus(parsed.status) ? now : null;

    this.databaseService.transaction(() => {
      this.databaseService.db
        .prepare(
          `
          INSERT INTO events (
            id, title, description, startAt, endAt, allDay, status, completedAt, color, source, timezone, isRecurring, createdAt, updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          id,
          parsed.title,
          parsed.description,
          parsed.startAt,
          parsed.endAt,
          parsed.allDay ? 1 : 0,
          parsed.status,
          completedAt,
          parsed.color,
          parsed.source,
          parsed.timezone,
          parsed.recurrence.frequency === "none" ? 0 : 1,
          now,
          now,
        );

      this.syncTags(id, parsed.tags);
      this.syncNotes(id, parsed.noteIds);
      this.recurrenceService.saveRule(id, parsed.recurrence);
      this.linkService.rebuildWikiLinks("event", id, parsed.description);
    });

    return id;
  }

  update(id: string, payload: EventInput): boolean {
    const parsed = eventInputSchema.parse(payload);
    const now = new Date().toISOString();
    const completedAt = isDoneEventStatus(parsed.status) ? now : null;

    this.databaseService.transaction(() => {
      this.databaseService.db
        .prepare(
          `
          UPDATE events
          SET title = ?, description = ?, startAt = ?, endAt = ?, allDay = ?, status = ?, completedAt = ?, color = ?, source = ?, timezone = ?, isRecurring = ?, updatedAt = ?
          WHERE id = ?
          `,
        )
        .run(
          parsed.title,
          parsed.description,
          parsed.startAt,
          parsed.endAt,
          parsed.allDay ? 1 : 0,
          parsed.status,
          completedAt,
          parsed.color,
          parsed.source,
          parsed.timezone,
          parsed.recurrence.frequency === "none" ? 0 : 1,
          now,
          id,
        );

      this.syncTags(id, parsed.tags);
      this.syncNotes(id, parsed.noteIds);
      this.recurrenceService.saveRule(id, parsed.recurrence);
      this.linkService.rebuildWikiLinks("event", id, parsed.description);
    });

    return true;
  }

  delete(id: string): boolean {
    const { baseId } = this.splitVirtualId(id);

    this.databaseService.transaction(() => {
      this.databaseService.db.prepare("DELETE FROM event_notes WHERE eventId = ?").run(baseId);
      this.databaseService.db.prepare("DELETE FROM recurrence_rules WHERE eventId = ?").run(baseId);
      this.databaseService.db.prepare("DELETE FROM occurrence_overrides WHERE eventId = ?").run(baseId);
      this.databaseService.db.prepare("DELETE FROM entity_tags WHERE entityType = 'event' AND entityId = ?").run(baseId);
      this.databaseService.db.prepare("DELETE FROM annotations WHERE targetType = 'event' AND targetKey = ?").run(baseId);
      this.linkService.cleanupEntity("event", baseId);
      this.databaseService.db.prepare("DELETE FROM events WHERE id = ?").run(baseId);
    });

    return true;
  }

  setCompletion(id: string, done: boolean): boolean {
    const { baseId, occurrenceDate } = this.splitVirtualId(id);
    const now = new Date().toISOString();

    if (occurrenceDate) {
      this.recurrenceService.upsertOccurrenceOverride(
        baseId,
        occurrenceDate,
        occurrenceOverrideInputSchema.parse({
          overrideType: "status",
          status: done ? "완료" : "예정",
          completedAt: done ? now : null,
        }),
      );
      return true;
    }

    this.databaseService.db
      .prepare("UPDATE events SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?")
      .run(done ? "완료" : "예정", done ? now : null, now, baseId);
    return true;
  }

  upsertOccurrenceOverride(eventId: string, occurrenceDate: string, override: unknown): boolean {
    const parsed = occurrenceOverrideInputSchema.parse(override);
    this.recurrenceService.upsertOccurrenceOverride(eventId, occurrenceDate, parsed);
    return true;
  }

  private hydrateEvent(id: string, row?: EventRow): EventRecord & { tags: string[]; noteIds: string[]; noteCount: number; linkCount: number } {
    const event = row ?? (this.databaseService.db.prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow);
    const tags = this.databaseService.db
      .prepare(
        `
        SELECT t.name
        FROM tags t
        INNER JOIN entity_tags et ON et.tagId = t.id
        WHERE et.entityType = 'event' AND et.entityId = ?
        ORDER BY t.name ASC
        `,
      )
      .all(id)
      .map((item) => (item as { name: string }).name);
    const noteIds = this.databaseService.db
      .prepare("SELECT noteId FROM event_notes WHERE eventId = ?")
      .all(id)
      .map((item) => (item as { noteId: string }).noteId);
    const linkCount = (this.databaseService.db.prepare("SELECT COUNT(*) as count FROM link_edges WHERE sourceType = 'event' AND sourceId = ?").get(id) as {
      count: number;
    }).count;

    return {
      ...event,
      allDay: Boolean(event.allDay),
      status: normalizeEventStatus(event.status),
      isRecurring: Boolean(event.isRecurring),
      tags,
      noteIds,
      noteCount: noteIds.length,
      linkCount,
    };
  }

  private createExpandedBaseItem(event: EventRecord & { tags: string[]; noteIds: string[]; noteCount: number; linkCount: number }): ExpandedCalendarItem {
    const occurrenceDate = event.startAt ? toDateKey(event.startAt) : null;
    return {
      ...event,
      baseEventId: null,
      occurrenceDate,
      virtualInstanceId: null,
      isVirtual: false,
      overdue: this.isOverdue(event.status, event.endAt, event.startAt),
    };
  }

  private isInRange(event: ExpandedCalendarItem, rangeStartIso: string, rangeEndIso: string): boolean {
    const start = event.startAt ? dayjs(event.startAt) : dayjs(event.createdAt);
    const end = event.endAt
      ? dayjs(event.endAt)
      : event.allDay && event.startAt
        ? dayjs(endOfDayIso(toDateKey(event.startAt), event.timezone))
        : start;

    return !(end.isBefore(dayjs(rangeStartIso)) || start.isAfter(dayjs(rangeEndIso)));
  }

  private applyFilters(items: ExpandedCalendarItem[], filters: Record<string, unknown>): ExpandedCalendarItem[] {
    return items.filter((item) => {
      if (filters.status && item.status !== filters.status) {
        return false;
      }

      if (filters.source && item.source !== filters.source) {
        return false;
      }

      if (typeof filters.hasMemo === "boolean" && Boolean(item.noteCount > 0) !== filters.hasMemo) {
        return false;
      }

      if (typeof filters.isRecurring === "boolean" && item.isRecurring !== filters.isRecurring) {
        return false;
      }

      if (typeof filters.overdue === "boolean" && item.overdue !== filters.overdue) {
        return false;
      }

      if (typeof filters.tag === "string" && filters.tag && !item.tags.includes(filters.tag)) {
        return false;
      }

      if (typeof filters.query === "string" && filters.query.trim()) {
        const query = filters.query.trim().toLowerCase();
        const haystack = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  private syncTags(eventId: string, tags: string[]): void {
    this.databaseService.db.prepare("DELETE FROM entity_tags WHERE entityType = 'event' AND entityId = ?").run(eventId);
    const insertTag = this.databaseService.db.prepare(
      "INSERT INTO tags (id, name, color, createdAt) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO NOTHING",
    );
    const selectTag = this.databaseService.db.prepare("SELECT id FROM tags WHERE name = ?");
    const insertRelation = this.databaseService.db.prepare(
      "INSERT OR IGNORE INTO entity_tags (entityType, entityId, tagId, createdAt) VALUES ('event', ?, ?, ?)",
    );

    for (const rawTag of tags) {
      const tag = rawTag.trim();
      if (!tag) {
        continue;
      }

      insertTag.run(crypto.randomUUID(), tag, "#10b981", new Date().toISOString());
      const tagRow = selectTag.get(tag) as { id: string } | undefined;
      if (tagRow) {
        insertRelation.run(eventId, tagRow.id, new Date().toISOString());
      }
    }
  }

  private syncNotes(eventId: string, noteIds: string[]): void {
    this.databaseService.db.prepare("DELETE FROM event_notes WHERE eventId = ?").run(eventId);
    const statement = this.databaseService.db.prepare("INSERT OR IGNORE INTO event_notes (eventId, noteId, createdAt) VALUES (?, ?, ?)");
    const now = new Date().toISOString();
    for (const noteId of noteIds) {
      statement.run(eventId, noteId, now);
    }
  }

  private isOverdue(status: string, endAt: string | null, startAt: string | null): boolean {
    if (isClosedEventStatus(status)) {
      return false;
    }

    const compareTarget = endAt ?? (startAt ? endOfDayIso(toDateKey(startAt)) : null);
    return compareTarget ? dayjs(compareTarget).isBefore(dayjs()) : false;
  }

  private splitVirtualId(id: string): { baseId: string; occurrenceDate: string | null } {
    if (!id.includes("::")) {
      return { baseId: id, occurrenceDate: null };
    }

    const [baseId, occurrenceDate] = id.split("::");
    return { baseId, occurrenceDate };
  }
}
