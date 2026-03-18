import type { DatabaseService } from "@main/services/DatabaseService";
import type { AnnotationInput, AnnotationRecord } from "@shared/schemas/annotation";
import { annotationInputSchema } from "@shared/schemas/annotation";

export class AnnotationService {
  constructor(private readonly databaseService: DatabaseService) {}

  upsert(payload: AnnotationInput): string {
    const parsed = annotationInputSchema.parse(payload);
    const existing = this.databaseService.db
      .prepare("SELECT id, createdAt FROM annotations WHERE targetType = ? AND targetKey = ?")
      .get(parsed.targetType, parsed.targetKey) as { id: string; createdAt: string } | undefined;

    const id = existing?.id ?? crypto.randomUUID();
    const createdAt = existing?.createdAt ?? new Date().toISOString();
    const updatedAt = new Date().toISOString();

    this.databaseService.db
      .prepare(
        `
        INSERT INTO annotations (id, targetType, targetKey, content, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET content = excluded.content, updatedAt = excluded.updatedAt
        `,
      )
      .run(id, parsed.targetType, parsed.targetKey, parsed.content, createdAt, updatedAt);

    return id;
  }

  listByTarget(targetType: string, targetKey: string): AnnotationRecord[] {
    return this.databaseService.db
      .prepare("SELECT * FROM annotations WHERE targetType = ? AND targetKey = ? ORDER BY updatedAt DESC")
      .all(targetType, targetKey) as AnnotationRecord[];
  }
}
