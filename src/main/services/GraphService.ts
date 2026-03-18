import type { DatabaseService } from "@main/services/DatabaseService";
import type { GraphEdge, GraphNode } from "@shared/types/ipc";

export class GraphService {
  constructor(private readonly databaseService: DatabaseService) {}

  get(filters: Record<string, unknown> = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const showEvents = filters.showEvents !== false;
    const showNotes = filters.showNotes !== false;
    const showAnnotations = filters.showAnnotations !== false;
    const showTags = filters.showTags !== false;
    const query = typeof filters.query === "string" ? filters.query.trim().toLowerCase() : "";

    const nodes: GraphNode[] = [];

    if (showEvents) {
      const events = this.databaseService.db.prepare("SELECT id, title, color FROM events").all() as Array<{
        id: string;
        title: string;
        color: string;
      }>;
      nodes.push(
        ...events.map((item) => ({
          id: `event:${item.id}`,
          entityType: "event" as const,
          label: item.title,
          color: item.color || "#2563eb",
        })),
      );
    }

    if (showNotes) {
      const notes = this.databaseService.db.prepare("SELECT id, title FROM notes").all() as Array<{ id: string; title: string }>;
      nodes.push(
        ...notes.map((item) => ({
          id: `note:${item.id}`,
          entityType: "note" as const,
          label: item.title,
          color: "#10b981",
        })),
      );
    }

    if (showAnnotations) {
      const annotations = this.databaseService.db.prepare("SELECT id, targetType, targetKey FROM annotations").all() as Array<{
        id: string;
        targetType: string;
        targetKey: string;
      }>;
      nodes.push(
        ...annotations.map((item) => ({
          id: `annotation:${item.id}`,
          entityType: "annotation" as const,
          label: `${item.targetType}:${item.targetKey}`,
          color: "#f59e0b",
        })),
      );
    }

    if (showTags) {
      const tags = this.databaseService.db.prepare("SELECT id, name, color FROM tags").all() as Array<{
        id: string;
        name: string;
        color: string;
      }>;
      nodes.push(
        ...tags.map((item) => ({
          id: `tag:${item.id}`,
          entityType: "tag" as const,
          label: item.name,
          color: item.color || "#ec4899",
        })),
      );
    }

    const nodeSet = new Set(nodes.map((item) => item.id));
    const edges: GraphEdge[] = [];

    const linkEdges = this.databaseService.db.prepare("SELECT * FROM link_edges").all() as Array<{
      id: string;
      sourceType: string;
      sourceId: string;
      targetType: string;
      targetId: string;
      linkType: string;
    }>;
    for (const edge of linkEdges) {
      const source = `${edge.sourceType}:${edge.sourceId}`;
      const target = `${edge.targetType}:${edge.targetId}`;
      if (nodeSet.has(source) && nodeSet.has(target)) {
        edges.push({
          id: edge.id,
          source,
          target,
          label: edge.linkType,
          linkType: edge.linkType,
        });
      }
    }

    const noteRelations = this.databaseService.db.prepare("SELECT eventId, noteId FROM event_notes").all() as Array<{
      eventId: string;
      noteId: string;
    }>;
    for (const relation of noteRelations) {
      const source = `event:${relation.eventId}`;
      const target = `note:${relation.noteId}`;
      if (nodeSet.has(source) && nodeSet.has(target)) {
        edges.push({
          id: `event_note:${relation.eventId}:${relation.noteId}`,
          source,
          target,
          label: "related",
          linkType: "related",
        });
      }
    }

    const tagRelations = this.databaseService.db.prepare("SELECT entityType, entityId, tagId FROM entity_tags").all() as Array<{
      entityType: string;
      entityId: string;
      tagId: string;
    }>;
    for (const relation of tagRelations) {
      const source = `${relation.entityType}:${relation.entityId}`;
      const target = `tag:${relation.tagId}`;
      if (nodeSet.has(source) && nodeSet.has(target)) {
        edges.push({
          id: `tag_relation:${relation.entityType}:${relation.entityId}:${relation.tagId}`,
          source,
          target,
          label: "tag",
          linkType: "reference",
        });
      }
    }

    const annotationRelations = this.databaseService.db
      .prepare("SELECT id, targetKey FROM annotations WHERE targetType = 'event'")
      .all() as Array<{ id: string; targetKey: string }>;
    for (const relation of annotationRelations) {
      const source = `annotation:${relation.id}`;
      const target = `event:${relation.targetKey}`;
      if (nodeSet.has(source) && nodeSet.has(target)) {
        edges.push({
          id: `annotation_event:${relation.id}:${relation.targetKey}`,
          source,
          target,
          label: "reference",
          linkType: "reference",
        });
      }
    }

    if (!query) {
      return { nodes, edges };
    }

    const filteredNodes = nodes.filter((item) => item.label.toLowerCase().includes(query));
    const filteredSet = new Set(filteredNodes.map((item) => item.id));
    return {
      nodes: filteredNodes,
      edges: edges.filter((item) => filteredSet.has(item.source) || filteredSet.has(item.target)),
    };
  }
}
