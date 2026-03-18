import type { DatabaseService } from "@main/services/DatabaseService";
import type { SearchResults } from "@shared/types/ipc";
import type { EventStatus } from "@shared/constants/enums";

export class SearchService {
  constructor(private readonly databaseService: DatabaseService) {}

  global(query: string): SearchResults {
    const trimmed = query.trim();
    if (!trimmed) {
      return { events: [], notes: [], annotations: [], tags: [] };
    }

    const likeValue = `%${trimmed}%`;
    const eventRows = this.databaseService.db
      .prepare(
        `
        SELECT
          id,
          title,
          description,
          startAt,
          endAt,
          allDay,
          status,
          completedAt,
          color,
          source,
          timezone,
          isRecurring,
          createdAt,
          updatedAt
        FROM events
        WHERE title LIKE ? COLLATE NOCASE OR description LIKE ? COLLATE NOCASE
        ORDER BY updatedAt DESC
        LIMIT 20
        `,
      )
      .all(likeValue, likeValue) as Array<{
      id: string;
      title: string;
      description: string;
      startAt: string | null;
      endAt: string | null;
      allDay: number;
      status: EventStatus;
      completedAt: string | null;
      color: string;
      source: "manual" | "ai";
      timezone: string;
      isRecurring: number;
      createdAt: string;
      updatedAt: string;
    }>;
    const events = eventRows.map((row) => ({
        ...row,
        allDay: Boolean(row.allDay),
        isRecurring: Boolean(row.isRecurring),
        baseEventId: null,
        occurrenceDate: null,
        virtualInstanceId: null,
        isVirtual: false,
        tags: [],
        noteIds: [],
        noteCount: 0,
        linkCount: 0,
        overdue: false,
      }));

    const notes = this.databaseService.db
      .prepare(
        `
        SELECT * FROM notes
        WHERE title LIKE ? COLLATE NOCASE OR content LIKE ? COLLATE NOCASE
        ORDER BY updatedAt DESC
        LIMIT 20
        `,
      )
      .all(likeValue, likeValue) as SearchResults["notes"];

    const annotations = this.databaseService.db
      .prepare(
        `
        SELECT * FROM annotations
        WHERE content LIKE ? COLLATE NOCASE OR targetKey LIKE ? COLLATE NOCASE
        ORDER BY updatedAt DESC
        LIMIT 20
        `,
      )
      .all(likeValue, likeValue) as SearchResults["annotations"];

    const tags = this.databaseService.db
      .prepare(
        `
        SELECT * FROM tags
        WHERE name LIKE ? COLLATE NOCASE
        ORDER BY name ASC
        LIMIT 20
        `,
      )
      .all(likeValue) as Array<{ id: string; name: string; color: string }>;

    return { events, notes, annotations, tags };
  }
}
