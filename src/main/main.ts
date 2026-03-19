import { app, BrowserWindow } from "electron";
import { registerIpcHandlers } from "@main/ipc/registerIpcHandlers";
import { createMainWindow } from "@main/window";
import { AnnotationService } from "@main/services/AnnotationService";
import { AiService } from "@main/services/AiService";
import { DatabaseService } from "@main/services/DatabaseService";
import { EventService } from "@main/services/EventService";
import { ExportImportService } from "@main/services/ExportImportService";
import { FormulaService } from "@main/services/FormulaService";
import { GraphService } from "@main/services/GraphService";
import { LinkService } from "@main/services/LinkService";
import { NoteService } from "@main/services/NoteService";
import { RecurrenceService } from "@main/services/RecurrenceService";
import { SearchService } from "@main/services/SearchService";
import { SettingsService } from "@main/services/SettingsService";
import { Logger } from "@main/utils/logger";

let mainWindow: BrowserWindow | null = null;
let logger: Logger | null = null;
let databaseService: DatabaseService | null = null;

function serializeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? "",
    };
  }

  return {
    message: String(error),
  };
}

function registerProcessLogging(activeLogger: Logger): void {
  process.on("uncaughtException", (error) => {
    activeLogger.error("Uncaught exception", serializeError(error));
  });

  process.on("unhandledRejection", (reason) => {
    activeLogger.error("Unhandled rejection", serializeError(reason));
  });
}

async function bootstrap(): Promise<void> {
  const userDataPath = app.getPath("userData");
  logger = new Logger(userDataPath);
  registerProcessLogging(logger);
  logger.info("Application bootstrap started", { userDataPath });

  databaseService = new DatabaseService(userDataPath, logger);
  databaseService.init();

  const settingsService = new SettingsService(databaseService, logger);
  settingsService.init();
  const linkService = new LinkService(databaseService);
  const recurrenceService = new RecurrenceService(databaseService);
  const noteService = new NoteService(databaseService, linkService);
  const annotationService = new AnnotationService(databaseService);
  const eventService = new EventService(databaseService, recurrenceService, linkService);
  const graphService = new GraphService(databaseService);
  const formulaService = new FormulaService(databaseService);
  const aiService = new AiService(databaseService, settingsService, logger);
  const exportImportService = new ExportImportService(databaseService, settingsService, logger);
  const searchService = new SearchService(databaseService);

  registerIpcHandlers({
    annotationService,
    aiService,
    eventService,
    exportImportService,
    formulaService,
    graphService,
    linkService,
    logger,
    noteService,
    searchService,
    settingsService,
  });

  mainWindow = createMainWindow(logger);
  mainWindow.on("closed", () => {
    logger?.info("Main window reference cleared");
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  app.setName("Calendar AI Desktop");
  if (process.platform === "win32") {
    app.setAppUserModelId("CalendarAIDesktop");
  }

  await bootstrap();

  app.on("activate", () => {
    logger?.info("Application activate event");
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(logger ?? undefined);
    }
  });
});

app.on("before-quit", () => {
  logger?.info("Application before-quit");
  databaseService?.close();
});

app.on("window-all-closed", () => {
  logger?.info("All windows closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});
