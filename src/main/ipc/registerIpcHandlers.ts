import { app, ipcMain, shell } from "electron";
import type { AnnotationService } from "@main/services/AnnotationService";
import type { AiService } from "@main/services/AiService";
import type { EventService } from "@main/services/EventService";
import type { ExportImportService } from "@main/services/ExportImportService";
import type { FormulaService } from "@main/services/FormulaService";
import type { GraphService } from "@main/services/GraphService";
import type { LinkService } from "@main/services/LinkService";
import type { Logger } from "@main/utils/logger";
import type { NoteService } from "@main/services/NoteService";
import type { SearchService } from "@main/services/SearchService";
import type { SettingsService } from "@main/services/SettingsService";
import { annotationInputSchema } from "@shared/schemas/annotation";
import { eventInputSchema } from "@shared/schemas/event";
import { formulaRuleInputSchema } from "@shared/schemas/formula";
import { noteInputSchema } from "@shared/schemas/note";

export type AppServices = {
  annotationService: AnnotationService;
  aiService: AiService;
  eventService: EventService;
  exportImportService: ExportImportService;
  formulaService: FormulaService;
  graphService: GraphService;
  linkService: LinkService;
  logger: Logger;
  noteService: NoteService;
  searchService: SearchService;
  settingsService: SettingsService;
};

export function registerIpcHandlers(services: AppServices): void {
  const handle = <T>(channel: string, callback: () => Promise<T> | T) => {
    ipcMain.handle(channel, async () => {
      try {
        return await callback();
      } catch (error) {
        services.logger.error(`IPC failure: ${channel}`, { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });
  };

  const handleWithPayload = <T, P>(channel: string, callback: (payload: P) => Promise<T> | T) => {
    ipcMain.handle(channel, async (_event, payload: P) => {
      try {
        return await callback(payload);
      } catch (error) {
        services.logger.error(`IPC failure: ${channel}`, { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });
  };

  handle("settings:getAll", () => ({ settings: services.settingsService.getAll() }));
  handleWithPayload("settings:update", (payload: { key: string; value: string }) =>
    services.settingsService.update(payload.key, payload.value),
  );

  handleWithPayload("events:listByRange", (payload: { rangeStart: string; rangeEnd: string; filters?: Record<string, unknown> }) => ({
    items: services.eventService.listByRange(payload.rangeStart, payload.rangeEnd, payload.filters ?? {}),
  }));
  handleWithPayload("events:getById", (payload: { id: string }) => ({ item: services.eventService.getById(payload.id) }));
  handleWithPayload("events:create", (payload: { payload: unknown }) => ({
    id: services.eventService.create(eventInputSchema.parse(payload.payload)),
  }));
  handleWithPayload("events:update", (payload: { id: string; payload: unknown }) => ({
    success: services.eventService.update(payload.id, eventInputSchema.parse(payload.payload)),
  }));
  handleWithPayload("events:delete", (payload: { id: string }) => ({ success: services.eventService.delete(payload.id) }));
  handleWithPayload("events:setCompletion", (payload: { id: string; done: boolean }) => ({
    success: services.eventService.setCompletion(payload.id, payload.done),
  }));
  handleWithPayload("events:upsertOccurrenceOverride", (payload: { eventId: string; occurrenceDate: string; override: unknown }) => ({
    success: services.eventService.upsertOccurrenceOverride(payload.eventId, payload.occurrenceDate, payload.override),
  }));

  handleWithPayload("notes:list", (payload: { query?: string } | undefined) => ({
    items: services.noteService.list(payload?.query),
  }));
  handleWithPayload("notes:create", (payload: { payload: unknown }) => ({
    id: services.noteService.create(noteInputSchema.parse(payload.payload)),
  }));
  handleWithPayload("notes:update", (payload: { id: string; payload: unknown }) => ({
    success: services.noteService.update(payload.id, noteInputSchema.parse(payload.payload)),
  }));
  handleWithPayload("notes:delete", (payload: { id: string }) => ({ success: services.noteService.delete(payload.id) }));

  handleWithPayload("annotations:upsert", (payload: { payload: unknown }) => ({
    id: services.annotationService.upsert(annotationInputSchema.parse(payload.payload)),
  }));
  handleWithPayload("annotations:listByTarget", (payload: { targetType: string; targetKey: string }) => ({
    items: services.annotationService.listByTarget(payload.targetType, payload.targetKey),
  }));

  handleWithPayload(
    "links:createManual",
    (payload: {
      sourceType: "event" | "note" | "annotation" | "tag";
      sourceId: string;
      targetType: "event" | "note" | "annotation" | "tag";
      targetId: string;
      linkType: "manual" | "wiki" | "reference" | "related" | "depends_on" | "blocked_by" | "child_of" | "parent_of";
    }) => ({
      id: services.linkService.createManual(
        payload.sourceType,
        payload.sourceId,
        payload.targetType,
        payload.targetId,
        payload.linkType,
      ),
    }),
  );
  handleWithPayload("links:listForEntity", (payload: { entityType: "event" | "note" | "annotation" | "tag"; entityId: string }) =>
    services.linkService.listForEntity(payload.entityType, payload.entityId),
  );

  handleWithPayload("graph:get", (payload: { filters?: Record<string, unknown> } | undefined) =>
    services.graphService.get(payload?.filters ?? {}),
  );

  handleWithPayload("formula:evaluate", (payload: { expression: string; targetType: string; context: Record<string, unknown> }) =>
    services.formulaService.evaluate(payload.expression, payload.targetType, payload.context),
  );
  handleWithPayload("formula:saveRule", (payload: { payload: unknown }) => ({
    id: services.formulaService.saveRule(formulaRuleInputSchema.parse(payload.payload)),
  }));
  handle("formula:listRules", () => ({ items: services.formulaService.listRules() }));

  handleWithPayload("search:global", (payload: { query: string }) => services.searchService.global(payload.query));

  handleWithPayload("ai:parseSchedule", async (payload: { inputText: string }) => ({
    result: await services.aiService.parseSchedule(payload.inputText),
  }));
  handleWithPayload("ai:summarizeRange", async (payload: { rangeStart: string; rangeEnd: string }) => ({
    summary: await services.aiService.summarizeRange(payload.rangeStart, payload.rangeEnd),
  }));

  handle("data:exportJson", async () => ({ filePath: await services.exportImportService.exportJson() }));
  handle("data:pickImportFile", async () => ({ filePath: await services.exportImportService.pickImportFile() }));
  handleWithPayload("data:importJson", (payload: { filePath: string }) => ({
    success: true,
    importedCounts: services.exportImportService.importJson(payload.filePath),
  }));

  handle("app:getMeta", () => ({
    version: app.getVersion(),
    userDataPath: app.getPath("userData"),
  }));
  handle("app:openDataDirectory", async () => {
    await shell.openPath(app.getPath("userData"));
    return { success: true };
  });
}
