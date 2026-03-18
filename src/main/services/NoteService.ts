import type { DatabaseService } from "@main/services/DatabaseService";
import type { LinkService } from "@main/services/LinkService";
import { noteInputSchema, type NoteInput, type NoteRecord } from "@shared/schemas/note";

export class NoteService {
  constructor(private readonly databaseService: DatabaseService, private readonly linkService: LinkService) {}

  list(query?: string): NoteRecord[] {
    if (query?.trim()) {
      const likeValue = `%${query.trim()}%`;
      return this.databaseService.db
        .prepare(
          `
          SELECT * FROM notes
          WHERE title LIKE ? COLLATE NOCASE OR content LIKE ? COLLATE NOCASE
          ORDER BY updatedAt DESC
          `,
        )
        .all(likeValue, likeValue) as NoteRecord[];
    }

    return this.databaseService.db.prepare("SELECT * FROM notes ORDER BY updatedAt DESC").all() as NoteRecord[];
  }

  create(payload: NoteInput): string {
    const parsed = noteInputSchema.parse(payload);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.databaseService.transaction(() => {
      this.databaseService.db
        .prepare(
          `
          INSERT INTO notes (id, title, content, contentFormat, createdAt, updatedAt)
          VALUES (?, ?, ?, 'plain_with_wikilinks', ?, ?)
          `,
        )
        .run(id, parsed.title, parsed.content, now, now);

      this.syncEventRelations(id, parsed.linkedEventIds);
      this.linkService.rebuildWikiLinks("note", id, parsed.content);
    });

    return id;
  }

  update(id: string, payload: NoteInput): boolean {
    const parsed = noteInputSchema.parse(payload);

    this.databaseService.transaction(() => {
      this.databaseService.db
        .prepare(
          `
          UPDATE notes
          SET title = ?, content = ?, updatedAt = ?
          WHERE id = ?
          `,
        )
        .run(parsed.title, parsed.content, new Date().toISOString(), id);

      this.syncEventRelations(id, parsed.linkedEventIds);
      this.linkService.rebuildWikiLinks("note", id, parsed.content);
    });

    return true;
  }

  delete(id: string): boolean {
    this.databaseService.transaction(() => {
      this.databaseService.db.prepare("DELETE FROM event_notes WHERE noteId = ?").run(id);
      this.databaseService.db.prepare("DELETE FROM entity_tags WHERE entityType = 'note' AND entityId = ?").run(id);
      this.linkService.cleanupEntity("note", id);
      this.databaseService.db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    });

    return true;
  }

  private syncEventRelations(noteId: string, linkedEventIds: string[]): void {
    this.databaseService.db.prepare("DELETE FROM event_notes WHERE noteId = ?").run(noteId);
    const statement = this.databaseService.db.prepare(
      "INSERT INTO event_notes (eventId, noteId, createdAt) VALUES (?, ?, ?)",
    );
    const now = new Date().toISOString();

    for (const eventId of linkedEventIds) {
      statement.run(eventId, noteId, now);
    }
  }
}
