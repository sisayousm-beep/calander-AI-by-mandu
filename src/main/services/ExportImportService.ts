import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, dialog } from "electron";
import type { DatabaseService } from "@main/services/DatabaseService";
import type { SettingsService } from "@main/services/SettingsService";
import type { Logger } from "@main/utils/logger";

const schemaVersion = "1.0.0";

export class ExportImportService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly settingsService: SettingsService,
    private readonly logger: Logger,
  ) {}

  async exportJson(): Promise<string> {
    const defaultPath = join(
      this.databaseService.backupsDir,
      `calendar-ai-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );

    const result = await dialog.showSaveDialog({
      title: "캘린더 데이터 내보내기",
      defaultPath,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (result.canceled || !result.filePath) {
      return "";
    }

    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
        schemaVersion,
      },
      data: {
        events: this.databaseService.listTable("events"),
        recurrenceRules: this.databaseService.listTable("recurrence_rules"),
        occurrenceOverrides: this.databaseService.listTable("occurrence_overrides"),
        notes: this.databaseService.listTable("notes"),
        eventNotes: this.databaseService.listTable("event_notes"),
        annotations: this.databaseService.listTable("annotations"),
        tags: this.databaseService.listTable("tags"),
        entityTags: this.databaseService.listTable("entity_tags"),
        linkEdges: this.databaseService.listTable("link_edges"),
        formulaRules: this.databaseService.listTable("formula_rules"),
        settings: (this.databaseService.listTable("app_settings") as Array<Record<string, unknown>>).map((item) =>
          item.key === "openAiApiKeyEncrypted" ? { ...item, value: "" } : item,
        ),
      },
    };

    writeFileSync(result.filePath, JSON.stringify(payload, null, 2), "utf8");
    return result.filePath;
  }

  async pickImportFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: "가져올 JSON 선택",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  importJson(filePath: string): Record<string, number> {
    const raw = readFileSync(filePath, "utf8");
    const payload = JSON.parse(raw) as {
      meta?: { schemaVersion?: string };
      data?: Record<string, Array<Record<string, unknown>>>;
    };

    if (payload.meta?.schemaVersion !== schemaVersion) {
      throw new Error("schemaVersion이 일치하지 않습니다.");
    }

    const data = payload.data ?? {};
    const counts: Record<string, number> = {};

    this.databaseService.transaction(() => {
      this.databaseService.db.exec(`
        DELETE FROM link_edges;
        DELETE FROM entity_tags;
        DELETE FROM event_notes;
        DELETE FROM occurrence_overrides;
        DELETE FROM recurrence_rules;
        DELETE FROM annotations;
        DELETE FROM formula_rules;
        DELETE FROM ai_parse_history;
        DELETE FROM notes;
        DELETE FROM tags;
        DELETE FROM events;
        DELETE FROM app_settings;
      `);

      this.insertRows("events", data.events ?? [], counts);
      this.insertRows("recurrence_rules", data.recurrenceRules ?? [], counts);
      this.insertRows("occurrence_overrides", data.occurrenceOverrides ?? [], counts);
      this.insertRows("notes", data.notes ?? [], counts);
      this.insertRows("event_notes", data.eventNotes ?? [], counts);
      this.insertRows("annotations", data.annotations ?? [], counts);
      this.insertRows("tags", data.tags ?? [], counts);
      this.insertRows("entity_tags", data.entityTags ?? [], counts);
      this.insertRows("link_edges", data.linkEdges ?? [], counts);
      this.insertRows("formula_rules", data.formulaRules ?? [], counts);
      this.insertRows(
        "app_settings",
        (data.settings ?? []).map((item) => (item.key === "openAiApiKeyEncrypted" ? { ...item, value: "" } : item)),
        counts,
      );
    });

    this.settingsService.init();
    this.logger.info("JSON import completed", { filePath, counts });
    return counts;
  }

  private insertRows(tableName: string, rows: Array<Record<string, unknown>>, counts: Record<string, number>): void {
    if (rows.length === 0) {
      counts[tableName] = 0;
      return;
    }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => "?").join(", ");
    const statement = this.databaseService.db.prepare(`INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`);

    for (const row of rows) {
      statement.run(...columns.map((column) => row[column]));
    }

    counts[tableName] = rows.length;
  }
}
