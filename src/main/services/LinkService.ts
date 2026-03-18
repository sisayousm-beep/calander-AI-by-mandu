import type { DatabaseService } from "@main/services/DatabaseService";
import type { LinkEdge } from "@shared/types/ipc";
import type { EntityType, LinkType } from "@shared/constants/enums";

type ResolvedEntity = { type: EntityType; id: string; title: string };

const wikiLinkPattern = /\[\[([^[\]]+)\]\]/g;

export class LinkService {
  constructor(private readonly databaseService: DatabaseService) {}

  createManual(sourceType: EntityType, sourceId: string, targetType: EntityType, targetId: string, linkType: LinkType): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.databaseService.db
      .prepare(
        `
        INSERT INTO link_edges (id, sourceType, sourceId, targetType, targetId, linkType, displayLabel, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(id, sourceType, sourceId, targetType, targetId, linkType, null, now, now);

    return id;
  }

  listForEntity(entityType: EntityType, entityId: string): { outgoing: LinkEdge[]; backlinks: LinkEdge[] } {
    const outgoing = this.getEdges("sourceType = ? AND sourceId = ?", [entityType, entityId]);
    const backlinks = this.getEdges("targetType = ? AND targetId = ?", [entityType, entityId]);
    return { outgoing, backlinks };
  }

  rebuildWikiLinks(sourceType: "event" | "note", sourceId: string, content: string): void {
    this.databaseService.db
      .prepare("DELETE FROM link_edges WHERE sourceType = ? AND sourceId = ? AND linkType = 'wiki'")
      .run(sourceType, sourceId);

    if (!content.trim()) {
      return;
    }

    const matches = [...content.matchAll(wikiLinkPattern)].map((match) => match[1].trim());
    const dedupe = new Set<string>();

    for (const rawReference of matches) {
      const resolved = this.resolveReference(rawReference);
      if (!resolved) {
        continue;
      }

      const key = `${resolved.type}:${resolved.id}`;
      if (dedupe.has(key)) {
        continue;
      }

      dedupe.add(key);
      const now = new Date().toISOString();
      this.databaseService.db
        .prepare(
          `
          INSERT INTO link_edges (id, sourceType, sourceId, targetType, targetId, linkType, displayLabel, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'wiki', ?, ?, ?)
          `,
        )
        .run(crypto.randomUUID(), sourceType, sourceId, resolved.type, resolved.id, rawReference, now, now);
    }
  }

  cleanupEntity(entityType: EntityType, entityId: string): void {
    this.databaseService.db
      .prepare("DELETE FROM link_edges WHERE sourceType = ? AND sourceId = ? OR targetType = ? AND targetId = ?")
      .run(entityType, entityId, entityType, entityId);
  }

  private resolveReference(rawReference: string): ResolvedEntity | null {
    const typedMatch = rawReference.match(/^(note|event)\s*:(.+)$/i);
    if (typedMatch) {
      const targetType = typedMatch[1].toLowerCase() as "note" | "event";
      const title = typedMatch[2].trim();
      return this.findByExactTitle(targetType, title);
    }

    const noteMatch = this.findByExactTitle("note", rawReference);
    const eventMatch = this.findByExactTitle("event", rawReference);
    const matches = [noteMatch, eventMatch].filter(Boolean) as ResolvedEntity[];
    return matches.length === 1 ? matches[0] : null;
  }

  private findByExactTitle(targetType: "note" | "event", title: string): ResolvedEntity | null {
    const tableName = targetType === "note" ? "notes" : "events";
    const row = this.databaseService.db
      .prepare(`SELECT id, title FROM ${tableName} WHERE title = ? LIMIT 1`)
      .get(title) as { id: string; title: string } | undefined;

    return row ? { type: targetType, id: row.id, title: row.title } : null;
  }

  private getEdges(whereClause: string, values: unknown[]): LinkEdge[] {
    const rows = this.databaseService.db
      .prepare(`SELECT * FROM link_edges WHERE ${whereClause} ORDER BY updatedAt DESC`)
      .all(...values) as Array<{
      id: string;
      sourceType: EntityType;
      sourceId: string;
      targetType: EntityType;
      targetId: string;
      linkType: LinkType;
      displayLabel: string | null;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((row) => ({
      ...row,
      sourceTitle: this.getEntityTitle(row.sourceType, row.sourceId),
      targetTitle: this.getEntityTitle(row.targetType, row.targetId),
    }));
  }

  private getEntityTitle(entityType: EntityType, entityId: string): string | null {
    if (entityType === "event") {
      const row = this.databaseService.db.prepare("SELECT title FROM events WHERE id = ?").get(entityId) as
        | { title: string }
        | undefined;
      return row?.title ?? null;
    }

    if (entityType === "note") {
      const row = this.databaseService.db.prepare("SELECT title FROM notes WHERE id = ?").get(entityId) as
        | { title: string }
        | undefined;
      return row?.title ?? null;
    }

    if (entityType === "tag") {
      const row = this.databaseService.db.prepare("SELECT name FROM tags WHERE id = ?").get(entityId) as
        | { name: string }
        | undefined;
      return row?.name ?? null;
    }

    const row = this.databaseService.db.prepare("SELECT targetKey FROM annotations WHERE id = ?").get(entityId) as
      | { targetKey: string }
      | undefined;
    return row?.targetKey ?? null;
  }
}
